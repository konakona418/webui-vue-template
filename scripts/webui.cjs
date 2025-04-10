const fs = require('fs');
const path = require('path');

const config = require('./webui.config.json');
const { execSync, exec } = require('child_process');

const printSeparatorLine = () => {
    console.log("------------------------------------------------------");
}

const copyDynLib = () => {
    const cwd = process.cwd();
    if (config.targetOs.toLowerCase() !== 'windows') {
        return;
    }
    const webviewDynLibPath = webviewFinder();
    if (webviewDynLibPath == "") {
        console.log("Webview DLL Not Found. Skip Copy Dynamic Library...");
        return;
    }
    const webviewDynLibDestPath = path.join(cwd, config.cpp.directory.build, 
        path.basename(webviewDynLibPath));
    if (!fs.existsSync(webviewDynLibDestPath)) {
        fs.copyFileSync(webviewDynLibPath, webviewDynLibDestPath);
        console.log(`Copied Webview DLL Successfully: ${webviewDynLibDestPath}`);
    } else {
        console.log(`Webview DLL Already Exists: ${webviewDynLibDestPath}`);
    }
}

const buildCppProject = (buildOption) => {
    let buildTargetType;
    if (buildOption === "dev") {
        buildTargetType = "Debug";
    } else if (buildOption === "build") {
        buildTargetType = "Release";
    } else {
        buildTargetType = config.cpp.defaultBuildTargetType;
    }

    const cwd = process.cwd();
    const target = config.cpp.targetName;
    const cppProjectPath = path.join(cwd, config.cpp.directory.source);
    const cppBuildPath = path.join(cwd, config.cpp.directory.build);

    console.log(`Building C++ Target: ${target}`);
    console.log("C++ Project Build Target Type: " + buildTargetType);

    if (!fs.existsSync(cppProjectPath)) {
        console.error(`C++ Project Directory Not Found: ${cppProjectPath}`);
        return false;
    }

    if (!fs.existsSync(cppBuildPath)) {
        fs.mkdirSync(cppBuildPath);
    }

    const makePath = config.cpp.buildSystem.path;
    const generatorPath = config.cpp.generator.path;
    const generatorName = config.cpp.generator.name;

    console.log(`CMake Path: ${makePath}`)
    console.log(`Generator Path: ${generatorPath}`);

    const baseMakeGenCommand = `"${makePath}" -S ${cppProjectPath} -B ${cppBuildPath} -G ${generatorName}`;

    let makeGenCommand = baseMakeGenCommand 
        + ` "-DCMAKE_MAKE_PROGRAM=${generatorPath}"` 
        + ` "-DCMAKE_BUILD_TYPE=${buildTargetType}"`;
    for (const [key, value] of Object.entries(config.cpp.buildSystem.options)) {
        makeGenCommand += ` "-D${key}=${value}"`;
    }
    console.log('Configuration done, begin generating CMake Project...')
    printSeparatorLine();
    
    console.log(`Building C++ Project. Phase 1/2: Generating Project...`);
    console.log(`Generate Command: ${makeGenCommand}`);
    try {
        execSync(makeGenCommand, {"stdio": "inherit"});
    } catch (error) {
        console.error(`CMake Error:\n${error}`);
        return false;
    } finally {
        console.log(`Generated CMake Project Successfully.`);
    }
    printSeparatorLine();

    console.log(`Building C++ Project. Phase 2/2: Building Project...`);

    const baseMakeBuildCommand = `"${makePath}" --build ${cppBuildPath} --target ${target}`;
    let makeBuildCommand = baseMakeBuildCommand;
    for (const [_, value] of Object.entries(config.cpp.buildArgs)) {
        let argName = value.key;
        let argValue = value.value;
        if (argValue =="") {
            makeBuildCommand += ` ${argName}`;
        } else {
            makeBuildCommand += ` ${argName} ${argValue}`;
        }
    }
    console.log(`Build Command: ${makeBuildCommand}`);
    try {
        execSync(makeBuildCommand, {"stdio": "inherit"});
    } catch (error) {
        console.error(`Build Error:\n${error}`);
        return false;
    } finally {
        console.log(`Built C++ Project Successfully.`);
    }
    printSeparatorLine();
    console.log('Running post-task for C++ Project...')
    console.log('Copying Webview Dynamic Library...')
    copyDynLib();
    console.log('Done');
    printSeparatorLine();
    return true;
}

const webviewFinder = () => {
    const cwd = process.cwd();
    if (config.targetOs.toLowerCase() !== 'windows') {
        console.log("Not Windows. Skip Find Webview DLL...");
        return ""
    }
    const webviewPath = path.join(cwd, config.cpp.directory.build, '_deps', 'microsoft_web_webview2-src');
    if (!fs.existsSync(webviewPath)) {
        console.error(`Downloaded webview File Not Found: ${webviewPath}`);
        return "";
    }
    const architecture = config.targetArchitecture;
    const webViewDynLibPath = path.join(webviewPath, 'runtimes', `win-${architecture.toLowerCase()}`, 
        'native', 'WebView2Loader.dll');
    if (!fs.existsSync(webViewDynLibPath)) {
        console.error(`Downloaded webview File Not Found: ${webViewDynLibPath}`);
        return "";
    }
    return webViewDynLibPath;
}

const generateIndexHtml = (buildOption) => {
    const cwd = process.cwd();
    if (!fs.existsSync(path.join(cwd, config.node.build.indexTemplate))) {
        return false;
    }

    console.log("Generating index.html");
    let template = fs.readFileSync(path.join(cwd, config.node.build.indexTemplate), 'utf-8');
    let sub;
    if (buildOption === "dev") {
        sub = `<script src="http://localhost:${config.node.debug.webuiServer}/webui.js"></script>`
    } else {
        sub = `<script src="webui.js"></script>`
    }
    template = template.replace('<!-- |SUBUSTITUTE WEBUI BRIDGE PATH| -->', sub);
    fs.writeFileSync(path.join(cwd, config.node.build.indexHtml), template);
    return true;
}

const copyNodeBuildFile = () => {
    const cwd = process.cwd();
    const nodeBuildPath = path.join(cwd, config.node.build.output);
    
    if (!fs.existsSync(nodeBuildPath)) {
        return false;
    }
    const dest = path.join(cwd, config.cpp.directory.build, config.cpp.directory.webuiSubDirName);
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest);
    }
    fs.cpSync(nodeBuildPath, dest, {recursive: true});
    return true;
}

const runTargetExecutable = () => {
    const cwd = process.cwd();
    console.log("Running Target Executable");
    let filename = (() => {
        if (config.targetOs.toLowerCase() === 'windows') {
            return `${config.cpp.targetName}.exe`;
        }
        return config.cpp.targetName;
    })();

    const target = path.join(cwd, config.cpp.directory.build, filename);
    if (!fs.existsSync(target)) {
        console.error(`Target Executable Not Found: ${target}`);
        return false;
    } else {
        console.log(`Target Executable Found: ${target}`);
    }

    console.log(`Executing: ${filename} --run-dev ${config.node.debug.nodeServer} ${config.node.debug.webuiServer}`);
    exec(`"${target}" --run-dev ${config.node.debug.nodeServer} ${config.node.debug.webuiServer}`, 
        (error, stdout, stderr) => {
            if (error) {
                console.error(`Node.js Error:\n${error}`);
                return false;
            }
            console.log(`[INFO] ${stdout}`);
            console.error(`[ERRO] ${stderr}`);
        }
    )
    return true;
}

const buildNodeProject = (buildOption) => {
    const cwd = process.cwd();
    console.log("Building Node Project");
    console.log("Build Option: " + buildOption);
    if (!generateIndexHtml(buildOption)) {
        console.log("Generate index.html Failed");
        return false;
    }
    printSeparatorLine();

    let command = (() => {
        if (buildOption === "dev") {
            return config.node.build.commands.dev;
        } else {
            return config.node.build.commands.build;
        }
    })();

    try {
        if (buildOption === "dev") {
            if (!runTargetExecutable()) {
                return false;
            }
            console.log("Starting Node.js Debug Server...");
        }
        execSync(command, {"stdio": "inherit"});
    } catch (error) {
        console.error(`Node Build Error:\n${error}`);
        return false;
    } finally {
        console.log(`Built Node Project Successfully.`);
    }
    printSeparatorLine();

    if (buildOption === "build") {
        console.log("Copying Node Build File...");
        if (!copyNodeBuildFile()) {
            console.log("Copy Node Build File Failed");
            return false;
        }
        console.log("Done");
    }
    printSeparatorLine();
    return true;
}

process.chdir(path.join(__dirname, '..'));
console.log("Current Running Under Directory: " + process.cwd());

console.log("Starting WebUI CLI...");
const buildOption = process.argv[2] ? process.argv[2].toLowerCase() : "none";

if (buildOption === "none" || buildOption !== "dev" && buildOption !== "build") {
    console.log("Unknown usage. Type --help for help.")
    process.exit(1);
}

if (buildOption == "--help") {
    console.log("Usage: node build.js <buildOption> [<params>]");
    console.log("buildOption: dev, build");
    console.log("params: no-cpp");
}

let noBuildCppProject = false;
if (process.argv.length > 3) {
    for (let i = 3; i < process.argv.length; i++) {
        if (process.argv[i].toLowerCase() === "no-cpp") {
            noBuildCppProject = true;
        } else {
            console.log(`Unknown param: ${process.argv[i]}`);
        }
    }
}

console.log("Build Option: " + buildOption);
printSeparatorLine();

if (!noBuildCppProject) {
    if (!buildCppProject(buildOption)) {
        console.log("C++ Project Build Failed");
        process.exit(1);
    }
}

console.log("C++ Project Build Successful");

if (!buildNodeProject(buildOption)) {
    console.log("Node Project Build & Run Failed");
    process.exit(1);
}

console.log("Node Project Build Successful");

console.log("Building Project Successful");