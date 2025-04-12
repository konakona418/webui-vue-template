# webui-vue-template

## Description

A template for combining Vue.js and WebUI for building desktop applications.

It provides a basic code structure for bootstrapping a Vue.js - TS - WebUI application.

## Usage

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Initialize the WebUI CMake project with `npm run webui init`.

To run the application under development mode, use `npm run webui dev`.

To build the application for production, use `npm run webui build`.

Additional parameters can be passed to the `webui` script, such as:

- `no-reload`: do not regenerate the CMake project.
- `no-cpp`: do not rebuild the C++ part of the application.
