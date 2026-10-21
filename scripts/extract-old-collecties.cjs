const {load}=require("cheerio");const fs=require("fs");
const out={};
for(const f of ["teamkleding-collectie","sportkleding-collectie"]){
  const $=load(fs.readFileSync(`raw/${f}.html`,"utf8"));
  $("header,footer,script,style,nav,form,#loginpopupnew").remove();
  const items=[];
  $("h1,h2,h3").each((_,el)=>{
    const tag=el.tagName, t=$(el).text().replace(/\s+/g," ").trim();
    if(tag!=="h3"){items.push({tag,t});return;}
    const box=$(el).parent();
    const desc=box.clone().children("h3,img,a,ul,div").remove().end().text().replace(/\s+/g," ").trim();
    const href=box.find("a[href]").first().attr("href")||$(el).closest("a").attr("href")||"";
    const extra=box.find("p,ul").map((_,e)=>$.html(e)).get().join("");
    items.push({tag,t,desc,href,extra:extra.slice(0,2000)});
  });
  out[f]=items;
  console.log("=== "+f);
  items.forEach(i=>console.log(`[${i.tag}] ${i.t}${i.desc?" :: "+i.desc.slice(0,110)+(i.desc.length>110?"…":"")+" ("+i.desc.split(" ").length+"w)":""}${i.href?" → "+i.href:""}`));
}
fs.writeFileSync("audit/old-collecties.json",JSON.stringify(out,null,2));
