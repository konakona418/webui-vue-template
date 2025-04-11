#include "lib.hpp"

void webui_main(webui::window& window, webui_context ctx, int* err) {
    window.bind("greetCpp", [](webui::window::event* event) {
        std::string name = event->get_string(0);
        event->return_string("Hello from C++, " + name + "!");
    });
}