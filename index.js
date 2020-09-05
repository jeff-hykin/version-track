#!/usr/bin/env node
const path = require("path")
const { existsSync, writeFileSync } = require("fs")
const { execSync } = require('child_process')

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
 *             "versionCommand": "git --version"
 *         }
 *     ]
 *   }
 * })
 * 
 */
function getUpdatedPackageObject(packageJson) {
    // create a copy to prevent mutation
    packageJson = JSON.parse(JSON.stringify(packageJson))
    // make sure the versionTracker exists in the package json
    if (!(packageJson.versionTracker                  instanceof Object)) { packageJson.versionTracker                  = {}      }
    if (!(packageJson.versionTracker.successfulBuilds instanceof Object)) { packageJson.versionTracker.successfulBuilds = {}      }
    if (!(packageJson.versionTracker.track            instanceof Array )) { packageJson.versionTracker.track            = []      }
    if (typeof packageJson.version != 'string'                          ) { packageJson.version                         = "0.0.0" }
    
    // create a spot for the current version if needed 
    let projectVersion = packageJson.version
    if (!(packageJson.versionTracker.successfulBuilds[projectVersion] instanceof Array)) { packageJson.versionTracker.successfulBuilds[projectVersion] = [] }

    // retrive the current versions of everything
    let versionEntry = {
        platform: process.platform,
        executables: {}
    }
    
    // add all the versions
    for (let eachTrackable of packageJson.versionTracker.track) {
        try {
            versionEntry.executables[eachTrackable.name] = execSync(eachTrackable.versionCommand).toString().trim()
        } catch (error) {
            versionEntry.executables[eachTrackable.name] = null
        }
    }

    // add it to the version history if its not already there
    const entryAsString = JSON.stringify(versionEntry)
    const entriesAsStrings = packageJson.versionTracker.successfulBuilds[projectVersion].map(each=>JSON.stringify(each))
    if (!entriesAsStrings.includes(entryAsString)) {
        // reorganize so that latest are on top
        let currentVerisonEntries = packageJson.versionTracker.successfulBuilds[projectVersion]
        // insert at front
        currentVerisonEntries.unshift(versionEntry)
        delete packageJson.versionTracker.successfulBuilds[projectVersion]
        packageJson.versionTracker.successfulBuilds = {
            // most recent
            [projectVersion]: currentVerisonEntries,
            // all the older builds
            ...packageJson.versionTracker.successfulBuilds
        }
    }
    // reorder the versions so that newest is on top
    packageJson.versionTracker.successfulBuilds = {
        [projectVersion]: packageJson.versionTracker.successfulBuilds[projectVersion],
        ...packageJson.versionTracker.successfulBuilds
    }
    return packageJson
}

/**
 * Adds to (or creates) package.json with version tracking
 *
 * @param {string} indent - this is passed to JSON.stringify() for picking the indent level
 * @param {string} packageJsonPath - optional, specific package.json instead of closest one
 * @return {undefined}
 *
 * @example
 * // no args needed
 * generatePackageJsonWithTracking()
 * // indent with 4 spaces 
 * generatePackageJsonWithTracking(4)
 * // picking a specific json file
 * generatePackageJsonWithTracking(2, "./someFolder/package.json")
 */
function generatePackageJsonWithTracking(indent=2, packageJsonPath) {
    // if none given try to find one
    if (!packageJsonPath) {
        packageJsonPath = getPackageJsonPath()
    }
    // if package.json doesn't exist, then create one
    if (!packageJsonPath) {
        packageJsonPath = path.join(process.cwd(), "package.json")
        console.log(`Couldn't find a package.json\nCreating a skeleton package.json so versionTracker can function`)
        writeFileSync(
            packageJsonPath, 
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
            `        "versionCommand": "node -v"\n`+
            `      },\n`+
            `      {\n`+
            `        "name": "npm",\n`+
            `        "versionCommand": "npm -v"\n`+
            `      },\n`+
            `    ]\n`+
            `  },\n`+
            `}`
        )
    }
    // fails if packageJson is poorly formatted
    let packageJson = require(packageJsonPath)
    
    packageJson = getUpdatedPackageObject(packageJson)

    return writeFileSync(packageJsonPath, JSON.stringify(packageJson, 0, indent))
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

function getPackageJsonPath() {
    // find the package.json
    for (let eachFolder of walkUp()) {
        let packageJsonPath = path.join(eachFolder, "package.json")
        if (existsSync(packageJsonPath)) {
            return packageJsonPath
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
    if (process.argv[3]) {
        // if a number and not NaN
        if ((process.argv[3]-0) == (process.argv[3]-0)) {
            indent = process.argv[3]
        }
    }
    console.log(`generating tracking information`)
    generatePackageJsonWithTracking(indent)
    console.log(`package information generated!`)
}