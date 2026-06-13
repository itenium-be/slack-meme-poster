FROM node:20-alpine

RUN apk add --update --no-cache bash dos2unix

WORKDIR /usr/scheduler

COPY start.sh ./
COPY job/*.* ./job/
COPY reddit-job/*.* ./reddit-job/

RUN dos2unix start.sh job/*.* reddit-job/*.*

# Invoke bash explicitly: the repo lives on Dropbox/Windows so start.sh's exec bit
# isn't preserved (git mode 644), and the node base image's entrypoint would otherwise
# run a non-executable first arg via `node` (→ parses the bash script as JS).
CMD ["bash", "start.sh"]
