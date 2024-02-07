# CDK Svelte App

- [] Add turbo to project
- [x] Refactor server handler to create function
- [x] Use @codegenie/serverless-express to convert AWS Lambda Event to node req, res
- [x] Parametrize Svelte output path to get Svelte server
- [x] Update CDK version and use core apigw constructs
- [x] Add testing for server lambda
- [x] Check if SvelteKit Lambda Layer is needed or not, I assume it is not needed
- [] Check if check for no-cache control header makes sense, some of those 300 are permanent and caching makes sense in this case
- [x] Figure TS dev import vs Prd import
- [x] Remove the need for package.json magic for esm support in lambda
- [x] Check the use if a Lambda Layer for the resulting svelte server code
