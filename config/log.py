import logging
from enum import Enum


class LogLevel(Enum):
    """
    Enum for log levels.
    """

    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


logger = logging

# Logger configuration
logger.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s]: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
