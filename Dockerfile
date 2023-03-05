FROM node:16-alpine

RUN apk add --update --no-cache bash dos2unix

WORKDIR /usr/scheduler

COPY crontab.txt start.sh ./
COPY job/*.* ./job/

RUN dos2unix crontab.txt start.sh job/*.*

CMD ["./start.sh"]
