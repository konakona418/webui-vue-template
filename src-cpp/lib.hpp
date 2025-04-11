#ifndef WEBUI_APP
#define WEBUI_APP

#include "webui.hpp"

struct webui_context {
    bool is_dev;
    int argc;
    char** argv;

    webui_context(bool is_dev, int argc, char** argv) : is_dev(is_dev), argc(argc), argv(argv) {}
};

void webui_main(webui::window& window, webui_context ctx, int* err);

#endif