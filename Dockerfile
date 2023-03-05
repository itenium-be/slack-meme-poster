FROM node:16-alpine

RUN apk add --update --no-cache bash dos2unix

WORKDIR /usr/scheduler

COPY job/*.* ./job/
COPY crontab.txt ./
COPY start.sh .

RUN dos2unix crontab.txt start.sh job/*.*

CMD ["./start.sh"]
