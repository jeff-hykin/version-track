#!/usr/bin/env node
const path = require("path")
const { existsSync, writeFileSync, readFileSync } = require("fs")
const { spawnSync } = require('child_process')

/**
 * Adds tracked versions to an object
 * only really used if you don't want to write to a file
 * otherwise use generatePackageJsonWithTracking()
 *
 * @param {Object} packageJson - should contain tracking info and version
 * @return {Object} the updated object (original isn't mutated)
 *
 * @example
 * let updatedObject = getUpdatedPackageObject({
 *   version: "1.0.2",
 *   versionTracker: {
 *     "successfulBuilds": {},
 *     "track": [
 *         {
 *             "name": "git",
 *             "versionCommands": [
 *                 ["git", "--version"]
 *             ]
 *         }
 *     ]
 *   }
 * })
 * 
 */
function getUpdatedPackageObject({source, log}) {
    // create a copy to prevent mutation
    source = JSON.parse(JSON.stringify(source))
    let defaultTrackingInfo = [
        { name: "node", versionCommands: [["node", "--version"]] },
        { name: "npm" , versionCommands: [["npm", "-v"        ]] },
        { name: "git" , versionCommands: [["git", "--version" ]] },
    ]
    // make sure the versionTracker exists in the package json
    if (!(source.versionTracker                  instanceof Object)) { source.versionTracker                  = {}                  }
    if (!(source.versionTracker.successfulBuilds instanceof Object)) { source.versionTracker.successfulBuilds = {}                  }
    if (!(source.versionTracker.track            instanceof Array )) { source.versionTracker.track            = defaultTrackingInfo }
    if (typeof source.version != 'string'                          ) { source.version                         = "0.0.0"             }
    
    // create a spot for the current version if needed 
    let projectVersion = source.version
    if (!(source.versionTracker.successfulBuilds[projectVersion] instanceof Array)) { source.versionTracker.successfulBuilds[projectVersion] = [] }

    // retrive the current versions of everything
    let versionEntry = {
        platform: process.platform,
        executables: {}
    }
    // add all the versions
    for (let eachTrackable of source.versionTracker.track) {
        versionEntry.executables[eachTrackable.name] = null
        if (eachTrackable.versionCommands instanceof Array) {
            for (let eachCommand of eachTrackable.versionCommands) {
                if (eachCommand instanceof Array) {
                    let [ command, ...args ] = eachCommand
                    let result = spawnSync(command, args)
                    // if not successful then try the next command
                    if (result.status != 0) {
                        continue
                    }
                    // otherwise, use the output as the version
                    let output = ""
                    if (result.stdout) {
                        output += result.stdout.toString().trim()
                    }
                    if (result.stderr) {
                        output += result.stderr.toString().trim()
                    }
                    if (output.length > 0) {
                        // remove all the ANSI escape codes (colors)
                        output = output.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "")
                        // save the version
                        versionEntry.executables[eachTrackable.name] = output
                    }
                }
            }
            }
    }

    
    // add it to the version history if its not already there
    const entryAsString = JSON.stringify(versionEntry)
    let successfulBuilds = {...log}
    successfulBuilds[projectVersion]||(successfulBuilds[projectVersion]=[])
    const entriesAsStrings = successfulBuilds[projectVersion].map(each=>JSON.stringify(each))
    if (!entriesAsStrings.includes(entryAsString)) {
        // reorganize so that latest are on top
        let currentVerisonEntries = successfulBuilds[projectVersion]
        // insert at front
        currentVerisonEntries.unshift(versionEntry)
        delete successfulBuilds[projectVersion]
        successfulBuilds = {
            // most recent
            [projectVersion]: currentVerisonEntries,
            // all the older builds
            ...successfulBuilds
        }
    }
    // reorder the versions so that newest is on top
    successfulBuilds = {
        [projectVersion]: successfulBuilds[projectVersion],
        ...successfulBuilds
    }
    return {newSource: source, newLog: successfulBuilds}
}

/**
 * Adds to (or creates) package.json with version tracking
 *
 * @param {string} obj.indent - this is passed to JSON.stringify() for picking the indent level
 * @param {string} obj.source - optional, specific package.json instead of closest one
 * @param {string} obj.log - optional, path for saving the successfulBuilds in a seperate file
 * @return {undefined}
 *
 * @example
 * // no args needed
 * generatePackageJsonWithTracking()
 * // indent with 4 spaces 
 * generatePackageJsonWithTracking({indent: 4})
 * // picking a specific json file
 * generatePackageJsonWithTracking({indent: 2, source:"./someFolder/package.json"})
 * // picking a specific json file and log file
 * generatePackageJsonWithTracking({indent:2, source:"./someFolder/package.json", log:"versions-log.json"})
 * 
 */
function generatePackageJsonWithTracking({indent=2, source, log}) {
    // if none given try to find one
    if (!source) {
        source = getPathToPackageJson()
    }
    // if package.json doesn't exist, then create one
    if (!existsSync(source)) {
        source = path.join(process.cwd(), "package.json")
        console.log(`Couldn't find a package.json\nCreating a skeleton package.json so versionTracker can function`)
        writeFileSync(
            source, 
            // create a package.json similar to a version of npm init -y
            `{\n`+
            `  "name": "",\n`+
            `  "version": "0.0.0",\n`+
            `  "description": ""\n`+
            `  "scripts": {\n`+
            `    "test": "echo \\"Error: no test specified\\" && exit 1"\n`+
            `  },\n`+
            `  "keywords": [],\n`+
            `  "author": "",\n`+
            `  "license": "",\n`+
            `  "versionTracker": {\n`+
            `    "successfulBuilds": {},\n`+
            `    "track": [\n`+
            `      {\n`+
            `        "name": "node",\n`+
            `        "versionCommands": [ ["node", "-v"] ]\n`+
            `      },\n`+
            `      {\n`+
            `        "name": "npm",\n`+
            `        "versionCommands": [ ["npm", "-v"] ]\n`+
            `      },\n`+
            `    ]\n`+
            `  },\n`+
            `}`
        )
    }
    // fails if packageJson is poorly formatted
    let packageJson = JSON.parse(readFileSync(source))
    let logData
    // if not given log, use the packageJson path 
    if (!log) {
        logData = packageJson.versionTracker.successfulBuilds
    } else {
        if (existsSync(log)) {
            try {
                logData = JSON.parse(readFileSync(log))
            } catch(e){}
        }
    }
    logData || (logData = {})

    let {newSource, newLog} = getUpdatedPackageObject({source: packageJson, log: logData})
    // if log is in a different file, then extract the successfulBuilds
    if (source != log) {
        return writeFileSync(log, JSON.stringify(newLog, 0, indent))
    } else {
        source.successfulBuilds = newLog
        return writeFileSync(source, JSON.stringify(newSource, 0, indent))
    }
}

function walkUp() {
    let pwd = process.cwd()
    let output = []
    while (path.dirname(pwd) != pwd) {
        output.push(pwd)
        pwd = path.dirname(pwd)
    }
    return output
}

function getPathToPackageJson() {
    // find the package.json
    for (let eachFolder of walkUp()) {
        let source = path.join(eachFolder, "package.json")
        if (existsSync(source)) {
            return source
        }
    }
}

module.exports = {
    getUpdatedPackageObject,
    generatePackageJsonWithTracking,
}


// if run directly from the commandline
if (process.argv[2] == "generate") {
    let indent = 2
    let logPath = "./version-log.json"
    let source = "./package.json"
    let args = [...process.argv.slice(3,process.argv)]
    while (args.length > 0) {
        let key = args.shift()
        if (key == "--indent") {
            indent = args.shift()
        } else if (key == "--source") {
            source = args.shift()
        } else if (key == "--log") {
            logPath = args.shift()
        } else {
            console.error(`invalid argument '${key}', should be:\n--indent\n--source\n--log\n`)
        }
    }
    // convert the indent
    let asNumber = indent-0
    // if a real number and not NaN
    if (asNumber == asNumber) {
        indent = asNumber
    }

    console.log(`generating tracking information`)
    generatePackageJsonWithTracking({indent, source, log:logPath})
    console.log(`package information generated!`)
}