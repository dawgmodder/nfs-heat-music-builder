const fs=require('fs');
const path=require('path');

function createFreshBuildFolder(buildRoot,buildId){
  fs.mkdirSync(buildRoot,{recursive:true});
  const folder=path.join(buildRoot,buildId);
  fs.mkdirSync(folder,{recursive:false});
  return folder;
}

module.exports={createFreshBuildFolder};
