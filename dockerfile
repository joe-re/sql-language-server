FROM node:12

COPY . /opt/sql-language-server
WORKDIR /opt/sql-language-server
RUN yarn