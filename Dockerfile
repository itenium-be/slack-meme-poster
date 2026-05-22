FROM node:20-alpine

RUN apk add --update --no-cache bash dos2unix

WORKDIR /usr/scheduler

COPY start.sh ./
COPY job/*.* ./job/
COPY ai-job/*.* ./ai-job/

RUN dos2unix start.sh job/*.* ai-job/*.*

CMD ["./start.sh"]
