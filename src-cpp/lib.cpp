#include "lib.hpp"

#include <thread>

void webui_main(webui::window& window, webui_context ctx, int* err) {
    window.bind("greetCpp", [](webui::window::event* event) {
        std::string name = event->get_string(0);
        event->return_string("Hello from C++, " + name + "!");
    });

    std::thread([window]() {
        while (true) {
            window.run("timer();");
            std::this_thread::sleep_for(std::chrono::milliseconds(1000));
        }
    }).detach();
}