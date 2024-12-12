
class Users_API {
    static API_URL() { return "http://localhost:5000/" };
    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
    }
    static setHttpErrorState(xhr) {
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description;
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }
    static async HEAD() {
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL(),
                type: 'HEAD',
                contentType: 'text/plain',
                complete: data => { resolve(data.getResponseHeader('ETag')); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Get(data) {
        Users_API.initHttpState();
        console.log(data);
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL()+`api/accounts?email=${data.Email}`,
                type: "GET",
                headers: {
                    "Authorization": "Bearer "+JSON.parse(sessionStorage.getItem("activeToken")).Access_token,
                    "Content-Type": "application/json"
                },
                success: (data) => { resolve(data); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Index(data) {
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL()+`accounts/index`,
                type: "GET",
                headers: {
                    "Authorization": "Bearer "+JSON.parse(sessionStorage.getItem("activeToken")).Access_token,
                    "Content-Type": "application/json"
                },
                success: (data) => { resolve(data); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }


    static async Promote(data) {
        Users_API.initHttpState();
        
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL()+`accounts/promote`,
                type: "POST",
                headers: {
                    "Authorization": "Bearer "+JSON.parse(sessionStorage.getItem("activeToken")).Access_token,
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(data),
                success: (data) => { resolve(data); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }


    static async Block(data) {
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL()+`accounts/block`,
                type: "POST",
                headers: {
                    "Authorization": "Bearer "+JSON.parse(sessionStorage.getItem("activeToken")).Access_token,
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(data),
                success: (data) => { resolve(data); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }


    static async GetQuery(queryString = "") {
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + queryString,
                
                complete: data => {
                    resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON });
                },
                error: (xhr) => {
                    Users_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
    static async Login(data){
        return new Promise(resolve=>{
            $.ajax({
                url : this.API_URL()+`token`,
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(data),
                success: (data)=>{resolve(data);},
                error: (xhr)=>{console.log(xhr);Users_API.setHttpErrorState(xhr); resolve(xhr.responseJSON);}
            });
        });
    }
    static async Verify(data){
        return new Promise(resolve=>{
            $.ajax({
                url : this.API_URL()+`accounts/verify?Id=${data.Id}&code=${data.code}`,
                type: "GET",
                contentType: "application/json",
                success: (data)=>{resolve(data);},
                error: (xhr)=>{Users_API.setHttpErrorState(xhr); resolve(xhr.error_description);}
            });
        });
    }
    static async Logout(userId){
        sessionStorage.removeItem("activeUser");
        sessionStorage.removeItem("activeToken");
        
        return new Promise(resolve=>{
            $.ajax({
                url : this.API_URL()+`accounts/logout?userId=${userId}`,
                type: "GET",
                success: (data)=>{resolve(data);},
                error: (xhr)=>{Users_API.setHttpErrorState(xhr); resolve(null);}
            });
        });
    }
    static async Save(data, create = true) {
        Users_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: create ? this.API_URL()+`accounts/register`: this.API_URL() + `accounts/modify`,
                type: create ? "POST" : "PUT",
                headers:create?{
                    
                    "Content-Type": "application/json"
                } :{
                    "Authorization": "Bearer "+JSON.parse(sessionStorage.getItem("activeToken")).Access_token,
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(data),
                
                success: (data) => { resolve(data); },
                error: (xhr) => { Users_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Delete(data) {
        console.log(data);
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + `accounts/remove/${data}`,
                type: "GET",
                headers: {
                    "Authorization": "Bearer "+JSON.parse(sessionStorage.getItem("activeToken")).Access_token,
                    "Content-Type": "application/json"
                },
                data:{userId:JSON.stringify(data)},
                complete: () => {
                    Users_API.initHttpState();
                    resolve(true);
                },
                error: (xhr) => {
                    Users_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
}