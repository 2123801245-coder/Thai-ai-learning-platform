import axios from "axios";
import { API_BASE_URL } from "@/lib/api";


const api = axios.create({

baseURL:

API_BASE_URL,


timeout:10000,


headers:{

"Content-Type":"application/json"

}

});





// 自动携带 token

api.interceptors.request.use(

(config)=>{


const token = localStorage.getItem(
"token"
);



if(token){

config.headers.Authorization =
`Bearer ${token}`;

}



return config;


},


(error)=>{

return Promise.reject(error);

}

);







// 登录

export const login = (data)=>{

return api.post(
"/auth/login",
data
);

};







// 注册

export const register = (data)=>{

return api.post(
"/auth/register",
data
);

};







// 获取当前用户

export const getMe = ()=>{


return api.get(
"/auth/me"
);


};







// 退出

export const logout = ()=>{


localStorage.removeItem(
"token"
);


};






// 激活 VIP（激活码）

export const activateVip = (code)=>{


return api.post(
"/auth/vip/activate",
{ code }
);


};






// ==================== 管理端（激活码管理） ====================




// 生成激活码

export const adminGenerateCodes = (params)=>{


return api.post(
"/admin/vip-codes",
params
);


};






// 激活码列表

export const adminListCodes = (status)=>{


return api.get(
"/admin/vip-codes",
{
params: { status }
}
);


};






// 收款对账台账
export const adminListLedger = (status = "all") => api.get("/admin/ledger", { params: { status } });
export const adminCreateLedger = (data) => api.post("/admin/ledger", data);
export const adminUpdateLedger = (id, data) => api.patch(`/admin/ledger/${id}`, data);
export const adminExportLedger = () => api.get("/admin/ledger/export", { responseType: "blob" });

// 导出 CSV（返回 Blob）

export const adminExportCodes = (status)=>{


return api.get(
"/admin/vip-codes/export",
{
params: { status },
responseType: "blob"
}
);


};






export default api;