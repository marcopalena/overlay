FROM node:11-alpine
RUN mkdir -p /usr/app/node_modules && chown -R node:node /usr/app
WORKDIR /usr/app
COPY package.json .
USER node
RUN npm install --quiet --also=dev
COPY --chown=node:node . .
CMD [ "npm", "run", "start" ]