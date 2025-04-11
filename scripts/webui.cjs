const fs = require('fs');
const path = require('path');

const config = require('./webui.config.json');
const { execSync, exec } = require('child_process');

const Context = class {
    buildOption;
    shouldBuildCpp;
    shouldReloadCMakeFile;
    constructor(buildOption, shouldBuildCpp, shouldReloadCMakeFile) {
        this.buildOption = buildOption;
        this.shouldBuildCpp = shouldBuildCpp;
        this.shouldReloadCMakeFile = shouldReloadCMakeFile;
    }
}

const printSeparatorLine = () => {
    console.log("");
}

const copyDynLib = () => {
    const cwd = process.cwd();
    if (config.targetOs.toLowerCase() !== 'windows') {
        return;
    }
    const webviewDynLibPath = webviewFinder();
    if (webviewDynLibPath == "") {
        console.log("Webview DLL not found. Skip copying dynamic library...");
        return;
    }
    const webviewDynLibDestPath = path.join(cwd, config.cpp.directory.build, 
        path.basename(webviewDynLibPath));
    if (!fs.existsSync(webviewDynLibDestPath)) {
        fs.copyFileSync(webviewDynLibPath, webviewDynLibDestPath);
        console.log(`Copied webview DLL successfully: ${webviewDynLibDestPath}`);
    } else {
        console.log(`Webview DLL already exists: ${webviewDynLibDestPath}`);
    }
}

const buildCppProject = (ctx) => {
    const buildOption = ctx.buildOption;
    let buildTargetType = (() => {
        if (buildOption === "dev") {
            return "Debug";
        } else if (buildOption === "build") {
            return "Release";
        } else {
            return config.cpp.defaultBuildTargetType;
        }
    })();
    

    const cwd = process.cwd();
    const target = config.cpp.targetName;
    const cppProjectPath = path.join(cwd, config.cpp.directory.source);
    const cppBuildPath = path.join(cwd, config.cpp.directory.build);

    console.log(`Building C++ target: ${target}`);
    console.log("C++ project build target type: " + buildTargetType);

    if (!fs.existsSync(cppProjectPath)) {
        console.error(`C++ project directory not found: ${cppProjectPath}`);
        return false;
    }

    if (!fs.existsSync(cppBuildPath)) {
        fs.mkdirSync(cppBuildPath);
    }

    const makePath = config.cpp.buildSystem.path;
    const generatorPath = config.cpp.generator.path;
    const generatorName = config.cpp.generator.name;
    const compilerConf = config.cpp.compiler;

    console.log(`CMake Path: ${makePath}`)
    console.log(`Generator Path: ${generatorPath}`);
    console.log(`Using C++ compiler: ${compilerConf.name}`)

    const baseMakeGenCommand = `"${makePath}" -S ${cppProjectPath} -B ${cppBuildPath} -G ${generatorName}`;

    let makeGenCommand = baseMakeGenCommand 
        + ` "-DCMAKE_MAKE_PROGRAM=${generatorPath}"` 
        + ` "-DCMAKE_BUILD_TYPE=${buildTargetType}"`
        + ` "-DCMAKE_CXX_COMPILER=${compilerConf.path}"`;
    for (const [key, value] of Object.entries(config.cpp.buildSystem.options)) {
        makeGenCommand += ` "-D${key}=${value}"`;
    }
    console.log('Configuration done, begin generating CMake Project...')
    printSeparatorLine();
    
    console.log(`Building C++ project. Phase 1/2: generating project...`);
    // console.log(`Generate Command: ${makeGenCommand}`);
    try {
        if (ctx.shouldReloadCMakeFile) {
            execSync(makeGenCommand, {"stdio": "inherit"});
        } else {
            console.log(`Skip generating CMake project.`);
        }
    } catch (error) {
        console.error(`CMake error:\n${error}`);
        return false;
    } finally {
        console.log(`Generated CMake project successfully.`);
    }
    printSeparatorLine();

    console.log(`Building C++ project. Phase 2/2: building project...`);

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

    //console.log(`Build Command: ${makeBuildCommand}`);
    try {
        execSync(makeBuildCommand, {"stdio": "inherit"});
    } catch (error) {
        console.error(`Build error:\n${error}`);
        return false;
    } finally {
        console.log(`Built C++ project successfully.`);
    }
    printSeparatorLine();
    console.log('Running post-task for C++ Project...')
    console.log('Copying webview dynamic library...')
    copyDynLib();
    console.log('Done.');
    printSeparatorLine();
    return true;
}

const webviewFinder = () => {
    const cwd = process.cwd();
    if (config.targetOs.toLowerCase() !== 'windows') {
        console.log("Not windows. Skip finding webview DLL...");
        return ""
    }
    const webviewPath = path.join(cwd, config.cpp.directory.build, '_deps', 'microsoft_web_webview2-src');
    if (!fs.existsSync(webviewPath)) {
        console.error(`Downloaded webview file not found: ${webviewPath}`);
        return "";
    }
    const architecture = config.targetArchitecture;
    const webViewDynLibPath = path.join(webviewPath, 'runtimes', `win-${architecture.toLowerCase()}`, 
        'native', 'WebView2Loader.dll');
    if (!fs.existsSync(webViewDynLibPath)) {
        console.error(`Downloaded webview file not found: ${webViewDynLibPath}`);
        return "";
    }
    return webViewDynLibPath;
}

const generateIndexHtml = (buildOption) => {
    const cwd = process.cwd();
    if (!fs.existsSync(path.join(cwd, config.node.build.indexTemplate))) {
        return false;
    }

    console.log("Generating index.html...");
    let template = fs.readFileSync(path.join(cwd, config.node.build.indexTemplate), 'utf-8');
    let sub;
    if (buildOption === "dev") {
        sub = `<script src="http://localhost:${config.node.debug.webuiServer}/webui.js"></script>`
    } else {
        sub = `<script src="webui.js"></script>`
    }
    template = template.replace(config.node.build.subStrings.webuiBridge, sub);
    fs.writeFileSync(path.join(cwd, config.node.build.indexHtml), template);
    console.log("Generated index.html successfully.");
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
    console.log(`Copying Node.js build file...`);
    console.log(`Removing old Node.js build file...`);
    fs.rmSync(dest, {recursive: true, force: true});
    fs.cpSync(nodeBuildPath, dest, {recursive: true});
    console.log(`Copied Node.js build file successfully.`);
    return true;
}

const runTargetExecutable = () => {
    const cwd = process.cwd();
    console.log("Running target executable...");
    let filename = (() => {
        if (config.targetOs.toLowerCase() === 'windows') {
            return `${config.cpp.targetName}.exe`;
        }
        return config.cpp.targetName;
    })();

    const target = path.join(cwd, config.cpp.directory.build, filename);
    if (!fs.existsSync(target)) {
        console.error(`Target executable not found: ${target}`);
        return false;
    } else {
        console.log(`Target executable found: ${target}`);
    }

    console.log(`Executing: ${filename} --run-dev ${config.node.debug.nodeServer} ${config.node.debug.webuiServer}`);
    exec(`"${target}" --run-dev ${config.node.debug.nodeServer} ${config.node.debug.webuiServer}`, 
        (error, stdout, stderr) => {
            if (error) {
                console.error(`Node.js error:\n${error}`);
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
    console.log("Building node project...");
    if (!generateIndexHtml(buildOption)) {
        console.log("Generate index.html failed.");
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
            console.log("Starting Node.js debug server...");
        }
        execSync(command, {"stdio": "inherit"});
    } catch (error) {
        console.error(`Node build error:\n${error}`);
        return false;
    } finally {
        console.log(`Built node project successfully.`);
    }
    printSeparatorLine();

    if (buildOption === "build") {
        console.log("Copying node build file...");
        if (!copyNodeBuildFile()) {
            console.log("Copy node build file failed.");
            return false;
        }
        console.log("Done.");
    }
    printSeparatorLine();
    return true;
}

process.chdir(path.join(__dirname, '..'));
console.log("Current running under directory: " + process.cwd());

console.log("Starting WebUI CLI...");
const buildOption = process.argv[2] ? process.argv[2].toLowerCase() : "none";

if (buildOption == "help") {
    console.log("Usage: node build.js <buildOption> [<params>]");
    console.log("buildOption: dev, build");
    console.log("params:");
    console.log("  no-cpp: Skip C++ project build");
    console.log("  no-reload: Skip reload CMake file");

    process.exit(0);
}

if (buildOption === "none" || buildOption !== "dev" && buildOption !== "build") {
    console.log("Unknown usage. Type 'help' for help.")
    process.exit(1);
}

let shouldBuildCppProject = true;
let shouldReloadCMakeFile = true;
if (process.argv.length > 3) {
    for (let i = 3; i < process.argv.length; i++) {
        switch (process.argv[i].toLowerCase()) {
            case "no-cpp":
                shouldBuildCppProject = false;
                break;
            case "no-reload":
                shouldReloadCMakeFile = false;
                break;
            default:
                console.log("Unknown params: " + process.argv[i]);
                break;
        }
    }
}

const ctx = new Context(buildOption, shouldBuildCppProject, shouldReloadCMakeFile);

console.log("Build option: " + buildOption);
printSeparatorLine();

if (ctx.shouldBuildCpp) {
    if (!buildCppProject(ctx)) {
        console.log("C++ project build failed.");
        process.exit(1);
    }
}

console.log("C++ project built successfully.");

printSeparatorLine();

if (!buildNodeProject(buildOption)) {
    console.log("Node project build & run failed.");
    process.exit(1);
}

console.log("Node project built successfully.");

console.log("Building project succeeded.");