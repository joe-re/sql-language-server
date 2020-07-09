FROM node:12

COPY ./example /opt/sql-language-server/example
COPY ./package.json yarn.lock /opt/sql-language-server/
COPY ./packages/server/package.json /opt/sql-language-server/packages/server/
COPY ./packages/sql-parser/package.json /opt/sql-language-server/packages/sql-parser/
COPY ./packages/sqlint/package.json /opt/sql-language-server/packages/sqlint/
WORKDIR /opt/sql-language-server
RUN yarn