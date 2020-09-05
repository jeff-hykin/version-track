## What is this?

Its a project management tool to keep track of versions of executables being used on a project. This makes projects easier for other people to get running.


## How do I use it?

`npm install version-tracker`

Then inside your `package.json`, add the "versionTracker" as seen below
```json
{
    "name": "name-of-your-project",
    "version": "1.7.4",
    "versionTracker": {
        "successfulBuilds": {},
        "track": [
            {
                "name": "git",
                "versionCommand": ["git", "--version"]
            },
            {
                "name": "python",
                "versionCommand": [ "python", "-V" ]
            }
        ]
    }
}
```

Whenever you've finished testing a version of your project, run the version tracker.
You can also run it in the commandline as:
```
npx version-tracker generate
# also: npx version-tracker generate 4 # will use an indent of 4 instead of 2
```
Or also inside of a `.js` file it can be done like this:
```js
let { generatePackageJsonWithTracking } = require("version-tracker")
generatePackageJsonWithTracking()
// generatePackageJsonWithTracking(4) // will use an indent of 4 instead of 2
```

After the generator is done, your package.json will contain something similar to the following.
```json
{
  "name": "name-of-your-project",
  "version": "1.7.4",
  "versionTracker": {
    "successfulBuilds": {
      "1.7.4": [
        {
          "platform": "darwin",
          "executables": {
            "git": "git version 2.27.0",
            "python": "Python 3.7.7"
          }
        }
      ]
    },
    "track": [
      {
        "name": "git",
        "versionCommand": ["git", "--version"]
      },
      {
        "name": "python",
        "versionCommand": [ "python", "-V" ]
      }
    ]
  }
}
```
