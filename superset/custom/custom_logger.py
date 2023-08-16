import logging
from datetime import datetime
import os
from superset.superset_config import LOGGER_PATH
class CustomFormatter(logging.Formatter):
    grey = "\x1b[38;21m"
    yellow = "\x1b[33;21m"
    red = "\x1b[31;21m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"
    format_val = (
        # "%(asctime)s - [%(levelname)s] - %(name)s - (%(filename)s).%(funcName)s(%(lineno)d) - %(message)s"
        "%(asctime)s - %(name)s - level=%(levelname)s - (%(filename)s).%(funcName)s(%(lineno)d) - %(message)s"
    )

    FORMATS = {
        logging.DEBUG: grey + format_val + reset,
        logging.INFO: grey + format_val + reset,
        logging.WARNING: yellow + format_val + reset,
        logging.ERROR: red + format_val + reset,
        logging.CRITICAL: bold_red + format_val + reset,
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)

def file_exist_or_not(file_path) -> None:
    directory = os.path.dirname(file_path)
    if not os.path.exists(directory):
        os.makedirs(directory)

    if os.path.exists(file_path):
        print("superset custom logger is running..")
    else:
        with open(file_path, 'w') as file:
            print("superset custom logger is created successfully..")

def get_logger(name):
    """
    :return:
    """
    filename = LOGGER_PATH + str(datetime.today().strftime("%d-%m-%Y")) + "_custom.log"
    file_exist_or_not(file_path=filename)

    logging.basicConfig(
        filename=filename,
        level=logging.DEBUG,
        force=True,
        format="%(asctime)s - %(name)s - level=%(levelname)s - (%(filename)s).%(funcName)s(%(lineno)d) - %(message)s"
    )
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    log_msg = logging.StreamHandler()
    log_msg.setLevel(logging.DEBUG)
    log_msg.setFormatter(CustomFormatter())
    # log_msg.addFilter(RequestIDLogFilter())
    logger.addHandler(log_msg)

    return logger
