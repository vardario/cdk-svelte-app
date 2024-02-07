# CDK Svelte App

- [] Add turbo to project
- [] Refactor server handler to create function
- [] Use @codegenie/serverless-express to convert AWS Lambda Event to node req, res
- [] Parametrize Svelte output path to get Svelte server
- [] Update CDK version and use core apigw constructs
- [] Add testing for server lambda
- [] Check if SvelteKit Lambda Layer is needed or not, I assume it is not needed
- [] Proxy all methods
  - [] PUT
  - [] PATCH
  - [] DELETE
- [] Check if check for no-cache control header makes sense, some of those 300 are permanent and caching makes sense in this case
- [] Figure TS dev import vs Prd import
- [] Remove the need for package.json magic for esm support in lambda
- [] Check the use if a Lambda Layer for the resulting svelte server code
