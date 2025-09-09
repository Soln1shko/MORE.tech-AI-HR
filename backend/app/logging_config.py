import logging
from logging.config import dictConfig


def setup_logging(level: str | int = "INFO") -> None:

    level_value = level if isinstance(level, int) else getattr(logging, str(level).upper(), logging.INFO)

    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
                },
                "access": {
                    "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                },
            },
            "root": {
                "level": level_value,
                "handlers": ["console"],
            },
            "loggers": {
                "werkzeug": {"level": level_value, "handlers": ["console"], "propagate": False},
                "flask.app": {"level": level_value, "handlers": ["console"], "propagate": False},
            },
        }
    )


