FROM python:3.10

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /code

RUN apt-get update && apt-get upgrade -y

RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/install-poetry.py | python -

ENV PATH /root/.local/bin:$PATH

COPY ./poetry.lock /code/poetry.lock
COPY ./pyproject.toml /code/pyproject.toml

RUN poetry install

COPY ./model /code/model
COPY ./util /code/util
COPY ./settings_reader.py /code/settings_reader.py
COPY ./main.py /code/main.py

ENV API_TOKEN ${API_TOKEN}
ENV POLL_TYPE ${POLL_TYPE}
ENV ENVIRONMENT ${ENVIRONMENT}
ENV RANDOM_SEED ${RANDOM_SEED}
ENV DOMAIN ${DOMAIN}
ENV PORT ${PORT}

ARG EXPOSE_PORT=${PORT}

EXPOSE ${EXPOSE_PORT}

ENTRYPOINT ["poetry", "run", "python", "main.py"]