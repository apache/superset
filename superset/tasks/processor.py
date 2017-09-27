from .tasklist import task_list


def validate_config(config):
    """
    Performs general configuration validation and then
    passes the JSON to the specific task type for validation
    """
    if 'type' not in config:
        raise ValueError("Task 'type' must be specified in config")
    task_type = config['type']
    if task_type not in task_list:
        raise ValueError("Task type {} does not exist".format(task_type))
    Task = task_list[task_type]
    return Task.validate_task_config(config)


def execute_task_config(config):
    """
    Create the appropriate task, passing it
    the configuration and then run.
    """
    if config['type'] not in task_list:
        return False  # ignore tasks that do not exist
    task_list[config['type']](config).execute()
    return True
