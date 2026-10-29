'use strict';
let contactMode='ai',humanSyncing=false;
const emptyHuman=()=>({me:{},friends:[],requests:[],relationshipRequests:[],messages:[],pins:{},reads:{},connected:false,background:false});
function humanData(){return emptyHuman();}function humanFriend(id){return {id,name:'此版本沒有真人好友',avatar:''};}function isHumanChat(){return false;}function humanRow(){return '';}
async function humanCall(){throw Error('此獨立版已移除人類功能');}
