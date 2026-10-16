export async function uploadEvidence(file:File,folder="reports"){
 if(file.size>5*1024*1024)throw new Error("Максимальный размер фото — 5 МБ.");
 if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw new Error("Выберите фото PNG, JPEG, WEBP или GIF.");
 const dataUrl=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error("Не удалось прочитать фото."));r.readAsDataURL(file);});
 const response=await fetch("/api/admin/upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData:window.Telegram?.WebApp?.initData||"",dataUrl,folder}),cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Не удалось загрузить фото.");return String(data.url);
}
