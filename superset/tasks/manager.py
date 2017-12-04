import threading

from time import time, sleep

from superset import db

from .models import CronTask
from .processor import execute_task_config

try:
    import Queue as Q
except ImportError:
    import queue as Q


class ManagedTask:
    """
    Wrapper class for `CronTask`. This object retains a reference to
    `task` and is placed in the `TaskManager` priority queue.
    """

    def __init__(self, task):
        self.task = task
        self.valid = True
        # managed tasks are compared by absolute execution time
        self.execution_time = task.abs_execution_time()

    def __repr__(self):
        return "Task id={}".format(self.task.id)

    def invalidate(self):
        """
        Tasks are invalidated so that they do not run,
        instead of trying to remove them from the queue
        """
        self.valid = False

    def run(self):
        if not self.valid:
            return False
        """
        Pass the task configuration JSON to run the task
        """
        return execute_task_config(self.task.config_json())

    def is_repeating(self):
        return self.task.is_repeating() and self.valid

    def __cmp__(self, other):
        if self.execution_time > other.execution_time:
            return 1
        elif self.execution_time < other.execution_time:
            return -1
        return 0

    def __lt__(self, other):
        return self.execution_time < other.execution_time

    def __eq__(self, other):
        return self.execution_time == other.execution_time


class TaskThread(threading.Thread):
    """
    Thread subclass which supports passing a target
    function and arguments.
    """
    def __init__(self, target, *args):
        self.target = target
        self.args = args
        threading.Thread.__init__(self)

    def run(self):
        self.target(*self.args)


# wrapper function for thread
def _run_task(managed_task):
    return managed_task.run()


class TaskManager:

    def __init__(self, existing_tasks=(), max_tasks=512, tick_delay=60):
        self.task_queue = Q.PriorityQueue(max_tasks)
        self.is_ticking = False
        self.tick_delay = tick_delay
        # keep a reference to existing tasks in the queue
        self.managed_tasks = {}
        # add existing tasks to the queue
        for existing_task in existing_tasks:
            self.enqueue_task(existing_task, False)

    def enqueue_task(self, task, start_if_stopped=True):
        if task.id in self.managed_tasks:
            # task ID already maps to a task, cancel existing task first
            self.cancel_task(task.id)
        # create a new managed task and add to queue
        managed_task = ManagedTask(task)
        self.managed_tasks[task.id] = managed_task
        self.task_queue.put_nowait(managed_task)
        # start ticking if not already
        if not self.is_ticking and start_if_stopped:
            self.start_ticking()

    def cancel_task(self, task_id):
        if task_id not in self.managed_tasks:
            # task ID does not exist, no task to cancel
            return False
        task = self.managed_tasks[task_id]
        task.invalidate()  # task will not run
        del self.managed_tasks[task_id]  # remove from task map

    def _tick(self):
        while self.is_ticking:
            # process tasks if any
            if len(self.task_queue.queue):
                # remove incoming invalidated tasks
                while (
                    len(self.task_queue.queue) and
                    not self.task_queue.queue[0].valid
                ):
                    self.task_queue.get_nowait()
                    self.task_queue.task_done()
                # if there are no more tasks, stop ticking
                if not len(self.task_queue.queue):
                    self.is_ticking = False
                    break
                # processing remaining valid tasks
                time_now = time()
                # run all tasks that need to be
                while (
                    len(self.task_queue.queue) and
                    time_now >= self.task_queue.queue[0].execution_time
                ):
                    # dequeue the next task
                    next_task = self.task_queue.get_nowait()
                    if next_task.valid:
                        # dispatch task into another thread
                        task_thread = TaskThread(_run_task, next_task)
                        task_thread.daemon = True
                        task_thread.start()
                        # remove from task map
                        del self.managed_tasks[next_task.task.id]
                    self.task_queue.task_done()
                    # if the task is repeating, push it to the queue
                    if next_task.is_repeating():
                        self.enqueue_task(next_task.task)
                if not len(self.task_queue.queue):
                    self.is_ticking = False
                    break
            else:
                # stop ticking when no more tasks
                self.is_ticking = False
                break
            sleep(self.tick_delay)

    def start_ticking(self):
        if len(self.task_queue.queue):
            # only start ticking if not already doing so
            if not self.is_ticking:
                self.is_ticking = True
                # self.thread is the thicking thread
                self.thread = threading.Thread(target=self._tick)
                self.thread.daemon = True
                self.thread.start()
        else:
            self.is_ticking = False


try:
    _existing_tasks = db.session.query(CronTask).all()
except:
    _existing_tasks = []
if 'task_manager' not in globals():
    # tick every 20 seconds
    task_manager = TaskManager(_existing_tasks, 1024, 20)
    task_manager.start_ticking()
_existing_tasks = None
