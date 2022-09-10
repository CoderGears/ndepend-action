const core = require('@actions/core');
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
const solution=core.getInput('solution');

var branch=process.env.GITHUB_HEAD_REF;
if(branch=="")
    branch="main";
let rooturl=process.env.GITHUB_SERVER_URL+"/"+process.env.GITHUB_REPOSITORY+"/blob/"+branch;

core.info(rooturl);
const configPath = core.getInput('customconfig');
const coveragePath = core.getInput('coveragefolder');

//get ndepend and extract it
const ndependToolURL = await tc.downloadTool('https://www.codergears.com/protected/GitHubActionAnalyzer.zip');
const ndependExtractedFolder = await tc.extractZip(ndependToolURL, _getTempDirectory()+'/NDepend');
var NDependParser=_getTempDirectory()+"/NDepend/GitHubActionAnalyzer/GitHubActionAnalyzer.exe"
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
      
      baselineFound= await checkIfNDependExists(owner,repo,runid);
    } 
    if(baselineFound)
    {
      core.info("Baseline to compare with has the run number:"+run.run_number)
      break;
    }
  }
};

var args=['/sourceDirectory',workspace,'/outputDirectory',NDependOut,'/githubRootUrl',rooturl];

if(configPath!="")
{
  //test in configpath exists else show message
  args.push("/ndependProject");
  args.push(workspace+"/"+configPath);
  
}
else
{
   populateSolutions(workspace);
   if(solutions.length==1)
   {
      args.push("/solutionPath");
      args.push(solutions[0]);
  }
  else if(solutions.length > 1)
  {
    if(solution!='')
    {
      args.push("/solutionPath");
      args.push(workspace+"/"+solution);
  
    }
    else
      core.setFailed("More than VS solution is found, please specify which one you want to parse from the action inputs")
  }
  else if(solutions.length ==0 )
  {
    core.setFailed("No VS solution is found in this repository")
  }
}
if(baselineFound)
{
  const ndependResultFile=getNDependResult(baseLineDir);
  args.push("/oldndependProject");
  args.push(ndependResultFile);
}
if(coveragePath!='')
  {
    args.push("/coverageDir");
    args.push(coveragePath);
  }
if(stopifQGfailed)
  args.push("/stopBuild");

var isLinux = process.platform === "linux";
if(isLinux)
{
   
  var NDependLinuxParser=_getTempDirectory()+"/NDepend/GitHubActionAnalyzer/net5.0/GitHubActionAnalyzer.MultiOS.dll";
  args.unshift(NDependLinuxParser);
  ret=await exec.exec("dotnet", args);
}
else
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
