FROM oven/bun:1-alpine

# bash for start.sh; dos2unix because the repo lives on Dropbox/Windows (CRLF). crond is busybox (alpine).
RUN apk add --update --no-cache bash dos2unix

WORKDIR /usr/scheduler

COPY start.sh ./
COPY deploy/*.env ./deploy/
COPY job/*.* ./job/
COPY reddit-job/*.* ./reddit-job/

RUN dos2unix start.sh deploy/*.env job/*.* reddit-job/*.*

# Run via bash (start.sh's exec bit isn't preserved on Dropbox/Windows).
CMD ["bash", "start.sh"]
