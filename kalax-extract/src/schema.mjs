export const EMPTY = Object.freeze({title:"",summary:"",keyPoints:[],decisions:[],actions:[],people:[],datesAndNumbers:[],needsReview:[],transcription:""});
export function validateReport(x){
 const bad=()=>{throw new Error("INVALID_MODEL_OUTPUT")}; if(!x||typeof x!=="object"||Array.isArray(x))bad();
 const strings=["title","summary","transcription"], arrays=["keyPoints","decisions","people","datesAndNumbers","needsReview"];
 for(const k of strings) if(typeof x[k]!=="string") bad(); for(const k of arrays) if(!Array.isArray(x[k])||x[k].some(v=>typeof v!=="string"))bad();
 if(!Array.isArray(x.actions)||x.actions.some(a=>!a||typeof a.action!=="string"||typeof a.owner!=="string"||typeof a.due!=="string"))bad();
 return {title:x.title,summary:x.summary,keyPoints:x.keyPoints,decisions:x.decisions,actions:x.actions.map(a=>({action:a.action,owner:a.owner,due:a.due})),people:x.people,datesAndNumbers:x.datesAndNumbers,needsReview:x.needsReview,transcription:x.transcription};
}
