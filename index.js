const core = require('@actions/core');
const wait = require('./wait');
const { Octokit } = require("@octokit/action");
const tc = require('@actions/tool-cache');
const exec = require('@actions/exec');
const artifact = require('@actions/artifact');

fs = require('fs');
path = require('path');
const artifactFiles=[];
const solutions=[];

function populateArtifacts(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
       
      populateArtifacts(fullPath);
     } else {
      artifactFiles.push(fullPath);
     }  
  });
}
function populateSolutions(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
       
      populateArtifacts(fullPath);
     } else {
      if (fullPath.endsWith(".sln")) {
        solutions.push(fullPath);
       }
      
     }  
  });
}
function getNDependResult(ndependFolder) {

  //console.log('Starting from dir '+startPath+'/');

  if (!fs.existsSync(ndependFolder)) {
      
      return "";
  }

  var files = fs.readdirSync(ndependFolder);
  for (var i = 0; i < files.length; i++) {
      var filename = path.join(ndependFolder, files[i]);
      
      var stat = fs.lstatSync(filename);
      if (stat.isDirectory()) {
          
      } else if (filename.endsWith(".ndar")) {
          return filename;
      };
  };
return "";
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
const stopifQGfailed=core.getInput('StopIfQGFailed');

core.info(owner);

core.info(repo);
var branch=process.env.GITHUB_HEAD_REF;
let rooturl=process.env.GITHUB_SERVER_URL+"/"+process.env.GITHUB_REPOSITORY+"/blob";
if(branch!="")
    rooturl=rooturl+"/"+process.env.GITHUB_HEAD_REF
else
    rooturl=rooturl+"/main"

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
const baseLineDir=_getTempDirectory()+'/NDependBaseLine';
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
var baselineFound=false;
for (const runkey in runs.data.workflow_runs) {
  const run=runs.data.workflow_runs[runkey];
  core.info("run check:"+run.id);
  if (baseline=='recent')
  {

  }
  else if(baseline.lastIndexOf('_recent'))
  {

  }
  else if(run.run_number.toString()==baseline)
  {
    //check if same repository
    core.info("run found:"+run.id);
    const runid=run.id;
    const artifacts  = await octokit.request("Get /repos/{owner}/{repo}/actions/runs/{runid}/artifacts", {
      owner,
      repo,
      runid
    });
    for (const artifactKey in artifacts.data.artifacts) {
      const artifact=artifacts.data.artifacts[artifactKey];
      if(artifact.name=="ndepend")
      {
        core.info("artifact found");
  
        var artifactid=artifact.id;
        response  = await octokit.request("Get /repos/{owner}/{repo}/actions/artifacts/{artifactid}/zip", {
          owner,
          repo,
          artifactid
        });
        //write data in file
        fs.writeFileSync(NDependBaseline, Buffer.from(response.data),  "binary",function(err) { });
        const baselineExtractedFolder = await tc.extractZip(NDependBaseline, baseLineDir);
        baselineFound=true;
      }
    };
    
  }
};



//'/outputDirectory', NDependOut,'/additionalOutput',workspace,'/sourceDirectory',workspace
//add these params
//sourcedir,rooturl,coveragedir,baseline,solutionPath in case of many .sln
//in case of ndproj not passed, search sln in sourcedir and create new ndepend project
//in case of many sln founds ask to specify solutionPath from params or from the ndproj file
var args=['sourceDirectory',workspace,'/outputDirectory',NDependOut,'/githubRootUrl',rooturl];

if(configPath!="")
{
  //test in configpath exists else show message
  args.push("/ndependProject");
  args.push(workspace+"/"+configPath);
  
}
else
{
   populateSolutions(workspace);
   if(len(solutions)==1)
   {
    args.push("/solutionPath");
    args.push(solutions[0]);
  
   }
}
if(baselineFound)
{
  const ndependResultFile=getNDependResult(baseLineDir);
  core.info("baseline path:"+ndependResultFile);
  args.push("/oldndependProject");
  args.push(ndependResultFile);
}
if(stopifQGfailed)
  args.push("/stopBuild");

ret=await exec.exec(NDependParser, args);

if(ret<0 && stopifQGfailed)
  core.setFailed("NDepend tool exit with error status.");
const artifactClient = artifact.create()
const artifactName = 'ndepend';

var files=[];
const rootDirectory = NDependOut;
/*fs.readdirSync(rootDirectory).forEach(file => {
  var fullPath = path.join(rootDirectory, file);
  files.push(fullPath);
});*/
populateArtifacts(NDependOut);

const options = {
    continueOnError: true
}

const uploadResult = await artifactClient.uploadArtifact(artifactName, artifactFiles, rootDirectory, options)


   
   
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
