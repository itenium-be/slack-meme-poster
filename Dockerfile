FROM node:16-alpine

RUN apk add --update --no-cache bash dos2unix

WORKDIR /usr/scheduler

COPY start.sh ./
COPY job/*.* ./job/

RUN dos2unix start.sh job/*.*

CMD ["./start.sh"]
