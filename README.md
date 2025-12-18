# falcontouch

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.0.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## To run containers one by one separeted from docker compose, follow the steps:

docker network create falcontouch-net

docker build -t falcontouch-backend:dev --build-arg NODE_ENV=development .     

docker run -d --name falcontouch-redis --network falcontouch-net -p 6379:6379 redis:7 

docker run --network falcontouch-net -p 3001:3001 --env-file .env.dev -e NODE_ENV=development -v "${PWD}:/app" -v "${PWD}\certs:/app/certs:ro" falcontouch-backend:dev sh -c "npm install && node server.js"

docker exec -it "container id" sh  