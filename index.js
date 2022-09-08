const core = require('@actions/core');
const wait = require('./wait');
const { Octokit } = require("@octokit/action");
const tc = require('@actions/tool-cache');
const exec = require('@actions/exec');
const artifact = require('@actions/artifact');

fs = require('fs');
path = require('path');
const artactFiles=[];
function traverseDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
       
       traverseDir(fullPath);
     } else {
      artactFiles.push(fullPath);
     }  
  });
}
function _getTempDirectory() {
  const tempDirectory = process.env['RUNNER_TEMP'] ;
  return tempDirectory;
}

// most @actions toolkit packages have async methods
async function run() {
  try {
    
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    })
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const workflowname=process.env.GITHUB_WORKFLOW;
const workspace=process.env.GITHUB_WORKSPACE;
//const license=process.env.NDependLicense;
const token=process.env.GITHUB_TOKEN;
const license=core.getInput('NDependLicense');
const baseline=core.getInput('Baseline');
core.info(owner);

core.info(repo);
var branch=process.env.GITHUB_HEAD_REF;
const rooturl=process.env.GITHUB_SERVER_URL+"/"+process.env.GITHUB_REPOSITORY+"/blob/"+process.env.GITHUB_HEAD_REF;
core.info(rooturl);
// get license
/*const { data } = await octokit.request("Get /repos/{owner}/ndepend2.github.io/contents/license", {
  headers: {
    accept: 'application/vnd.github.VERSION.raw',
  },
  owner
  
  
});*/
const configPath = core.getInput('NDependConfigFile');
//get ndepend and extract it
const node12Path = await tc.downloadTool('https://www.codergears.com/protected/GitHubActionAnalyzer.zip');
const node12ExtractedFolder = await tc.extractZip(node12Path, _getTempDirectory()+'/NDepend');
const NDependParser=_getTempDirectory()+"/NDepend/GitHubActionAnalyzer/GitHubActionAnalyzer.exe"
const licenseFile=_getTempDirectory()+"/NDepend/GitHubActionAnalyzer/NDependGitHubActionProLicense.xml"
const configFile=_getTempDirectory()+"/NDepend/GitHubActionAnalyzer/NDependConfig.ndproj"

const NDependOut=_getTempDirectory()+"/NDependOut";
const NDependBaseline=_getTempDirectory()+"/baseline.zip";

//add license file in ndepend install directory
fs.mkdirSync(NDependOut);
//fs.writeFileSync(licenseFile, result.data);
fs.writeFileSync(licenseFile, license);
//fs.writeFileSync(configFile, config.data);

/*const  config  = await octokit.repos.getContent({
  owner: owner,
  repo: repo,
  path: configPath,
  headers: {
    'Accept': 'application/vnd.github.v3.raw'
  }
})*/
// get branch name to use it in any request

//core.info(configPath);
//get config
// get all runs /repos/{owner}/{repo}/actions/runs
// find run id from run number or get latest
//get specific run artifacts /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts
//download ndar   /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}
//curl -H "Accept: application/vnd.github+json" -H "Authorization: Bearer token" https://api.github.com/repos/OWNER/REPO/actions/artifacts/ARTIFACT_ID/zip -o file
 runs  = await octokit.request("Get /repos/{owner}/{repo}/actions/runs", {
  owner,
  repo
  
});
for (const runkey in runs.data.workflow_runs) {
  const run=runs.data.workflow_runs[runkey];

  if(run.run_number.toString()==baseline)
  {
    core.info("run found");
    const runid=run.id;
    const artifacts  = await octokit.request("Get /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts", {
      owner,
      repo,
      runid
    });
    for (const artifactKey in artifacts.data.artifacts) {
      const artifact=artifacts.data.artifacts[artifactKey];
      if(artifact.name=="NDepend")
      {
        core.info("artifact found");
  
        var artifactId=artifact.id;
        response  = await octokit.request("Get /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip", {
          owner,
          repo,
          artifactId
        });
        //write data in file
        fs.writeFileSync(NDependBaseline, response.data,  "binary",function(err) { });
       
      }
    };
    
  }
};



//'/outputDirectory', NDependOut,'/additionalOutput',workspace,'/sourceDirectory',workspace
await exec.exec(NDependParser, [ '/ndependProject',workspace+"/"+configPath, '/outputDirectory',NDependOut]);

const artifactClient = artifact.create()
const artifactName = 'ndepend';

var files=[];
const rootDirectory = NDependOut;
/*fs.readdirSync(rootDirectory).forEach(file => {
  var fullPath = path.join(rootDirectory, file);
  files.push(fullPath);
});*/
traverseDir(NDependOut);

const options = {
    continueOnError: true
}

const uploadResult = await artifactClient.uploadArtifact(artifactName, artactFiles, rootDirectory, options)
//get sln file
//get baseline build id
//get baseline ndar if exists from a specific build

//execute ndepend

// add artifacts


    const ms = core.getInput('milliseconds');
    core.info(`Waiting ${ms} milliseconds6 ...`);

    core.debug((new Date()).toTimeString()); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
    await wait(parseInt(ms));
    core.info((new Date()).toTimeString());
    var tempDirectory = process.env['RUNNER_TEMP'] ;
    core.setOutput('time', new Date().toTimeString());
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
