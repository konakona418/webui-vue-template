#include "webui.hpp"
#include <iostream>
#include <string>
#include <cstring>

struct webui_context {
    bool is_dev;
    int argc;
    char** argv;

    webui_context(bool is_dev, int argc, char** argv) : is_dev(is_dev), argc(argc), argv(argv) {}
};

void webui_main(webui::window& window, webui_context ctx, int* err) {
    window.bind("greetCpp", [](webui::window::event* event) {
        std::string name = event->get_string(0);
        event->return_string("Hello from C++, " + name + "!");
    });
}

int main(int argc, char** argv) {
    webui::window window;

    bool is_dev = false;
    if (argc >= 4) {
        if (std::strcmp(argv[1], "--run-dev") == 0) {
            int node_port = std::stoi(argv[2]);
            int webui_port = std::stoi(argv[3]);

            std::cout << "Running in development mode" << std::endl;
            std::cout << "Node.js port: " << node_port << std::endl;
            std::cout << "WebUI port: " << webui_port << std::endl;
            
            if (!window.set_port(webui_port)) {
                std::cout << "Failed to set WebUI port" << std::endl;
            }
            if (!window.show_wv("http://localhost:" + std::to_string(node_port) + "/")) {
                std::cout << "Failed to start WebUI server" << std::endl;
            }
            is_dev = true;
        }
    } else {
        window.set_root_folder("./webui");
        window.show_wv("index.html");
    }
    int err = 0;
    webui_main(window, webui_context(is_dev, argc, argv), &err);
    webui::wait();
    std::cout << "Exiting..." << std::endl;
    return err;
}