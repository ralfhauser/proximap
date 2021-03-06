const writeFileSync = require('fs').writeFileSync;

const { dedent } = require('tslint/lib/utils');

const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function createVersionsFile(filename) {
  const revision = (await exec('git rev-parse --short HEAD')).stdout.toString().trim();
  const branch = (await exec('git rev-parse --abbrev-ref HEAD')).stdout.toString().trim();
  const version = (await exec('git tag -l HEAD')).stdout.toString().trim();
  const commit_time = (await exec('git log --format="%ai" -n1 HEAD')).stdout.toString().trim();
  
  console.log(`version: '${version}',
  revision: '${revision}',
  branch: '${branch}',
  time: '${commit_time}'`);
  
  const content = dedent`
      // this file is automatically generated by git.version.ts script
      export const versions = {
        version: '${version}',
        revision: '${revision}',
        branch: '${branch}',
        commit_time: '${commit_time}',
        build_time: '${new Date()}'
      };`;
  
  writeFileSync(filename, content, {encoding: 'utf8'});
}

createVersionsFile('src/environments/versions.ts');
