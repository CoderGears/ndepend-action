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
async function checkIfNDependExists(owner,repo,runid)
{
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
      
      fs.writeFileSync(NDependBaseline, Buffer.from(response.data),  "binary",function(err) { });
      const baselineExtractedFolder = await tc.extractZip(NDependBaseline, baseLineDir);
      return true;
    }
  }
}

async function run() {
  try {
    
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    })
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const workflowname=process.env.GITHUB_WORKFLOW;
const workspace=process.env.GITHUB_WORKSPACE;
const token=process.env.GITHUB_TOKEN;
const license=core.getInput('license');
const baseline=core.getInput('baseline');
const stopifQGfailed=core.getInput('stopIfQGFailed');

core.info(owner);

core.info(repo);
var branch=process.env.GITHUB_HEAD_REF;
if(branch=="")
    branch="main";
let rooturl=process.env.GITHUB_SERVER_URL+"/"+process.env.GITHUB_REPOSITORY+"/blob/"+branch;

core.info(rooturl);
const configPath = core.getInput('customconfig');
//get ndepend and extract it
const ndependToolURL = await tc.downloadTool('https://www.codergears.com/protected/GitHubActionAnalyzer.zip');
const ndependExtractedFolder = await tc.extractZip(ndependToolURL, _getTempDirectory()+'/NDepend');
const NDependParser=_getTempDirectory()+"/NDepend/GitHubActionAnalyzer/GitHubActionAnalyzer.exe"
const licenseFile=_getTempDirectory()+"/NDepend/GitHubActionAnalyzer/NDependGitHubActionProLicense.xml"
const configFile=_getTempDirectory()+"/NDepend/GitHubActionAnalyzer/NDependConfig.ndproj"
const baseLineDir=_getTempDirectory()+'/NDependBaseLine';
const NDependOut=_getTempDirectory()+"/NDependOut";
const NDependBaseline=_getTempDirectory()+"/baseline.zip";

//add license file in ndepend install directory
fs.mkdirSync(NDependOut);
fs.writeFileSync(licenseFile, license);
 runs  = await octokit.request("Get /repos/{owner}/{repo}/actions/runs", {
  owner,
  repo
  
});
var baselineFound=false;
for (const runkey in runs.data.workflow_runs) {
  const run=runs.data.workflow_runs[runkey];
  core.info("run check:"+run.run_number);
  core.info("repository:"+run.repository.name+":"+repo);
  if(run.repository.name==repo )
  {
    const runid=run.id;
    if (baseline=='recent' && run.head_branch==branch)
    {
      //check if ndepend artifact exists
      baselineFound= await checkIfNDependExists(owner,repo,runid);
    }
    else if(baseline.lastIndexOf('_recent'))
    {
       var currentBranch=baseline.substring(0,baseline.lastIndexOf('_recent'));
       if(currentBranch==branch)
          baselineFound= await checkIfNDependExists(owner,repo,runid);
    }
    else if(run.run_number.toString()==baseline)
    {
      core.info("run found:"+run.id);
      
      baselineFound= await checkIfNDependExists(owner,repo,runid);
    } 
    if(baselineFound)
      break;

  }
};

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
