import threading

from time import time, sleep

from superset import db

from .models import RefreshTask

try:
    import Queue as Q
except ImportError:
    import queue as Q


class ManagedTask:

    def __init__(self, task, key):
        self.task = task
        self.valid = True
        self.key = key
        self.execution_time = task.abs_execution_time()

    def invalidate(self):
        self.valid = False

    def run(self):
        self.task.run_task()


class TaskThread(threading.Thread):

    def __init__(self, target, *args):
        self._target = target
        self._args = args
        threading.Thread.__init__(self)

    def run(self):
        self._target(*self._args)


def _run_task(managed_task):
    managed_task.run()


class TaskManager:

    def __init__(self, existing_tasks, max_tasks=512, tick_delay=60):
        self.task_queue = Q.PriorityQueue(max_tasks)
        self.is_ticking = False
        self.task_key = 0
        self.tick_delay = tick_delay
        self.managed_tasks = {}
        self.id_key_map = {}
        self.invalidated_tasks = []
        # add existing tasks to the queue
        print("LOADING {} EXISTING TASKS".format(len(existing_tasks)))
        for existing_task in existing_tasks:
            self.enqueue_task(existing_task, False)

    def enqueue_task(self, task, start_if_stopped=True):
        print("ENQUEUEING TASK {}".format(task.id))
        if task.id in self.id_key_map:
            print("TASK ALREADY EXISTS, CANCELLING")
            # task ID already maps to a task key, cancel existing task
            self.cancel_task(task.id)
        # create a new managed task and add to queue
        managed_task = ManagedTask(task, self.task_key)
        self.managed_tasks[self.task_key] = managed_task
        self.id_key_map[task.id] = self.task_key
        self.task_key += 1
        self.task_queue.put_nowait(managed_task)
        # start ticking if not already
        if not self.is_ticking and start_if_stopped:
            print("TASK MANAGER NOT TICKING, STARTING")
            self.start_ticking()

    def cancel_task(self, task_id):
        print("CANCELLING TASK {}".format(task_id))
        if task_id not in self.id_key_map:
            print("TASK DOES NOT EXIST")
            # task ID does not exist, no task to cancel
            return
        task_key = self.id_key_map[task_id]
        task = self.managed_tasks[task_key]
        task.invalidate() # task will not run
        self.invalidated_tasks.append(task)
        del self.id_key_map[task_id]

    def _tick(self):
        while self.is_ticking:
            print("TICK")
            if len(self.task_queue.queue):
                # remove invalidated tasks
                while len(self.task_queue.queue) and not self.task_queue.queue[0].valid:
                    invalid_task = self.task_queue.get_nowait()
                    print("REMOVING INVALIDATED TASK {}".format(invalid_task.task.id))
                    del self.managed_tasks[invalid_task.key]
                    self.task_queue.task_done()
                # if there are no more tasks, stop ticking
                if not len(self.task_queue.queue):
                    self.is_ticking = False
                    print("NO MORE TASKS, STOPPING")
                    break
                # processing remaining valid tasks
                time_now = time()
                # run all tasks that need to be
                while len(self.task_queue.queue) and time_now >= self.task_queue.queue[0].execution_time:
                    # dequeue and run the task
                    next_task = self.task_queue.get_nowait()
                    print("DEQUEUEING AND RUNNING TASK {}".format(next_task.task.id))
                    # dispatch task into another thread
                    task_thread = TaskThread(_run_task, next_task)
                    task_thread.daemon = True
                    task_thread.start()
                    del self.managed_tasks[next_task.key]
                    del self.id_key_map[next_task.task.id]
                    self.task_queue.task_done()
                    # if the task is repeating, push it to the queue
                    if next_task.task.is_repeating():
                        print("RESCHEDULING THE TASK")
                        self.enqueue_task(next_task.task)
                if not len(self.task_queue.queue):
                    print("NO MORE TASKS, STOPPING")
                    self.is_ticking = False
                    break
            else:
                # stop ticking when no more tasks
                self.is_ticking = False
                print("NO MORE TASKS, STOPPING")
                break
            sleep(self.tick_delay)

    def start_ticking(self):
        print("STARTING TASK MANAGER TICK")
        if len(self.task_queue.queue):
            # only start ticking if not already doing so
            if not self.is_ticking:
                self.is_ticking = True
                self.thread = threading.Thread(target=self._tick)
                self.thread.daemon = True
                self.thread.start()
            else:
                print("TASK MANAGER ALREADY TICKING")
        else:
            print("NO TASKS, NOT TICKING")
            self.is_ticking = False


print("CREATING TASK MANAGER")
_existing_tasks = db.session.query(RefreshTask).all()
if not 'task_manager' in globals():
    task_manager = TaskManager(_existing_tasks, 1024, 20)
    #task_manager.start_ticking()
_existing_tasks = None
