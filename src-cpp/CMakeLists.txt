cmake_minimum_required(VERSION 3.29)
project(webui-template)

set(CMAKE_CXX_STANDARD 17)

set(DEBUG OFF)

include(FetchContent)
FetchContent_Declare(
        webui
        GIT_REPOSITORY https://github.com/webui-dev/webui
        GIT_TAG nightly
)
FetchContent_MakeAvailable(webui)

if(WIN32)
    set(FC_NAME microsoft_web_webview2)
    FetchContent_Declare(${FC_NAME}
            URL "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/${VERSION}"
            CONFIGURE_COMMAND "")
    FetchContent_MakeAvailable(${FC_NAME})
endif()

add_executable(${PROJECT_NAME} main.cpp)
target_link_libraries(${PROJECT_NAME} PRIVATE webui)
