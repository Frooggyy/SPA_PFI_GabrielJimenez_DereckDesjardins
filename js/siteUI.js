////// Author: Nicolas Chourot
////// 2024
//////////////////////////////

const periodicRefreshPeriod = 10;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;

let categories = [];
let selectedCategory = "";
let currentETag = "";
let periodic_Refresh_paused = false;
let postsPanel;
let itemLayout;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;
let user = null;

Init_UI();
async function Init_UI() {
    postsPanel = new PageManager('postsScrollPanel', 'postsPanel', 'postSample', renderPosts);
    $('#createPost').on("click", async function () {
        showCreatePostForm();
    });
    $('#abort').on("click", async function () {
        showPosts();
    });
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $("#showSearch").on('click', function () {
        toogleShowKeywords();
        showPosts();
    });

    this.user = sessionStorage.getItem("activeUser");
    installKeywordsOnkeyupEvent();
    showPosts();
    start_Periodic_Refresh();
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {
    $("#searchKeys").on('keyup', function () {
        clearTimeout(keywordsOnchangeTimger);
        keywordsOnchangeTimger = setTimeout(() => {
            cleanSearchKeywords();
            showPosts(true);
        }, keywordsOnchangeDelay);
    });
    $("#searchKeys").on('search', function () {
        showPosts(true);
    });
}
function cleanSearchKeywords() {
    /* Keep only keywords of 3 characters or more */
    let keywords = $("#searchKeys").val().trim().split(' ');
    let cleanedKeywords = "";
    keywords.forEach(keyword => {
        if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
    });
    $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
    $("#hiddenIcon").hide();
    $("#showSearch").show();
    if (showKeywords) {
        $("#searchKeys").show();
    }
    else
        $("#searchKeys").hide();
}
function hideSearchIcon() {
    $("#hiddenIcon").show();
    $("#showSearch").hide();
    $("#searchKeys").hide();
}
function toogleShowKeywords() {
    showKeywords = !showKeywords;
    if (showKeywords) {
        $("#searchKeys").show();
        $("#searchKeys").focus();
    }
    else {
        $("#searchKeys").hide();
        showPosts(true);
    }
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function intialView() {
    if(sessionStorage.getItem("activeUser")){
        $("#createPost").show();
    }else{
        $("#createPost").hide();
    }
    initTimeout();
    $("#hiddenIcon").hide();
    $("#hiddenIcon2").hide();
    $('#menu').show();
    $('#commit').hide();
    $('#abort').hide();
    $('#form').hide();
    $('#form').empty();
    $('#aboutContainer').hide();
    $('#errorContainer').hide();
    showSearchIcon();
}
async function showPosts(reset = false) {
    intialView();
    $("#viewTitle").text("Fil de nouvelles");
    periodic_Refresh_paused = false;
    if(sessionStorage.getItem("activeUser")){
        initTimeout(300, ()=>{Users_API.Logout(JSON.parse(sessionStorage.getItem("activeUser"))); showPosts();});
    }
    
    await postsPanel.show(reset);
}
function showVerificationForm() {
    hidePosts();
    $('#form').show();
    $("#viewTitle").text("Verification par Courriel");
    renderVerificationForm(sessionStorage.getItem("activeUser"));
}
function hidePosts() {
    noTimeout();
    postsPanel.hide();
    hideSearchIcon();
    $("#createPost").hide();
    $('#menu').hide();
    periodic_Refresh_paused = true;
}
function showForm() {
    hidePosts();
    $('#form').show();
    $('#commit').show();
    $('#abort').show();
}
function showError(message, details = "") {
    hidePosts();
    $('#form').hide();
    $('#form').empty();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#commit').hide();
    $('#abort').show();
    $("#viewTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").empty();
    $("#errorContainer").append($(`<div>${message}</div>`));
    $("#errorContainer").append($(`<div>${details}</div>`));
}

function showCreatePostForm() {
    hidePosts();
    showForm();
    $("#viewTitle").text("Ajout de nouvelle");
    renderPostForm();
}
function showEditPostForm(id) {
    hidePosts();
    showForm();
    $("#viewTitle").text("Modification");
    renderEditPostForm(id);
}
function showDeleteConfirm(user){
    renderDeleteConfirm(user);
}
function showDeletePostForm(id) {
    hidePosts();
    showForm();
    $("#viewTitle").text("Retrait");
    renderDeletePostForm(id);
}
function showLoginForm() {
    hidePosts();
    showForm();
    $('#commit').hide();
    $("#viewTitle").text("Connexion");
    renderLoginForm();
}
function showCreateUserForm(user = null) {
    hidePosts();
    showForm();
    $("#viewTitle").text("Creation de compte");
    renderUserForm(user);
}
function showAbout() {
    hidePosts();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#abort').show();
    $("#viewTitle").text("À propos...");
    $("#aboutContainer").show();
}
function showGestionPage(){
    hidePosts();
    $("#viewTitle").text("Gestion des usagers");
    renderAllUsers();
}


//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

function start_Periodic_Refresh() {
    setInterval(async () => {
        if (!periodic_Refresh_paused) {
            let etag = await Posts_API.HEAD();
            if (currentETag != etag) {
                currentETag = etag;
                showPosts();
            }
        }
    },
        periodicRefreshPeriod * 1000);
}
async function renderPosts(queryString) {
    
    let endOfData = false;
    queryString += "&sort=date,desc";
    compileCategories();
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    if (showKeywords) {
        let keys = $("#searchKeys").val().replace(/[ ]/g, ',');
        if (keys !== "")
            queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ',')
    }
    addWaitingGif();
    let response = await Posts_API.Get(queryString);
    console.log(response);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        console.log(response)
        let Posts = response.data;
        if (Posts.length > 0) {
            Posts.forEach(Post => {
                postsPanel.itemsPanel.append(renderPost(Post));
            });
        } else
            endOfData = true;
        linefeeds_to_Html_br(".postText");
        highlightKeywords();
        attach_Posts_UI_Events_Callback();
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}
function renderPost(post, loggedUser) {
    let date = convertToFrenchDate(UTC_To_Local(post.Date));
    let user = JSON.parse(sessionStorage.getItem("activeUser"));
    let likedUsers = "";
    let likeNb =0;
    let thumbStyle = "fa-regular fa-thumbs-up";
    if (post.Likes != undefined  ) {
        if (post.Likes != []) {
            likeNb = post.Likes.length;
            post.Likes.forEach(user=>{
                likedUsers += user.Name + "\n";
                if(sessionStorage.getItem("activeUser")){
                    if(user.Email == JSON.parse(sessionStorage.getItem("activeUser")).Email){
                        thumbStyle = "fa fa-thumbs-up";
                    }
                }
                
            })
        }
        else likeNb = 0;
    }else{
        likeNb = 0;
    }
    
    let headerIcons = ""
    if (user) {
        if(user.Id = post.User.Id){
            headerIcons =
            ` 
            <span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier nouvelle"></span>
            <span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer nouvelle"></span>
            <span class="likeCmd cmdIconSmall ${thumbStyle}" postId="${post.Id}" title="${likedUsers}"> ${likeNb}</span>
            `;
        }
        else{
            headerIcons =
             `
            <span class="cmdIconSmall"></span>
            <span class="cmdIconSmall"></span>
            <span class="likeCmd cmdIconSmall ${thumbStyle}" postId="${post.Id}" title="${likedUsers}"> ${likeNb}</span>
            `;
        }

    }
    console.log(post.User);
    return $(`
        <div class="post" id="${post.Id}">
            <div class="postHeader">
                ${post.Category}
                ${headerIcons}
            </div>
            <div class="postTitle"> ${post.Title} </div>
            <img class="postImage" src='${post.Image}'/>
            <div class="postUser">
                <img src="${post.User.Avatar}" class="UserAvatarXSmall">
                <div>${post.User.Name}</div>
                <div class="postDate"> ${date} </div>
            </div>
            
            <div postId="${post.Id}" class="postTextContainer hideExtra">
                <div class="postText" >${post.Text}</div>
            </div>
            <div class="postfooter">
                <span postId="${post.Id}" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher la suite"></span>
                <span postId="${post.Id}" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Réduire..."></span>
            </div>         
        </div>
    `);
}
 function renderAllUsers(){
    $("#form").show();
    $("#form").empty();
    $('#menu').show();
    $('#abort').show();
    let users = Users_API.Index().then((data)=>{ 
        data.forEach(user=>{
            renderUser(user);
            
        });
        $('.promoteCmd').on("click",async  function () {
            Users_API.Promote($(this).attr("id"));
            showGestionPage();
        });
        $('.deleteUserCmd').on("click", function () {
            Users_API.Delete($(this).attr("id")).then(()=>{
                Posts_API.DeleteAll($(this).attr("id"));
            });
        });
        $('.banCmd').on("click", function () {
            Users_API.Block($(this).attr("id"));
            showGestionPage();
        });
        
    });
    


}

function renderUser(user){
    let specificId = user.Id;
    $("#form").append(`
        <span class="user" id="${user.Id}">
        </span>
    `);
    $("#"+specificId).append(`
            <div>
                <img src="${user.Avatar}" alt="${user.Avatar}" class="UserAvatarXSmall">
            </div>
            <div>${user.Name}</div>
    `);
    if(user.Authorizations.readAccess == -1){
        $("#"+specificId).append(`
            <div class="fa-solid fa-ban cmdIconSmallColorless iconBox red banCmd" title="Débloquer ${user.Name}?" id="${user.Id}"></div>
            <div class="fa-solid fa-x cmdIconSmall iconBox" title="Débloquez cet usager pour changer son status"></div>
        `);
    }
    else if(user.Authorizations.readAccess == 1){
        $("#"+specificId).append(`
            <div class="fa-solid fa-ban cmdIconSmallColorless iconBox green banCmd" title="Bloquer ${user.Name}?" id="${user.Id}"></div>
            <div class="fa-solid fa-user cmdIconSmall iconBox promoteCmd" title="Changer pour super-usager?" id="${user.Id}"></div>
        `);
    }
    else if(user.Authorizations.readAccess == 2){
        $("#"+specificId).append(`
            <div class="fa-solid fa-ban cmdIconSmallColorless iconBox green banCmd" title="Bloquer ${user.Name}?" id="${user.Id}"></div>
            <div class="fa-solid fa-star cmdIconSmall iconBox promoteCmd" title="Changer pour administrateur?" id="${user.Id}"></div>
        `);
    }
    else if(user.Authorizations.readAccess == 3){
        $("#"+specificId).append(`
            <div class="fa-solid fa-ban cmdIconSmallColorless iconBox green banCmd" title="Bloquer ${user.Name}?" id="${user.Id}"></div>
            <div class="fa-solid fa-crown cmdIconSmall iconBox promoteCmd" title="Changer pour usager normal?" id="${user.Id}"></div>            
        `);
    }
    $("#"+specificId).append(`
        <div class="fa-solid fa-trash cmdIconSmall iconBox deleteUserCmd" title="Supprimer ${user.Name}?" id="${user.Id}"></div>
    `);
    
}

async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            if (!categories.includes(selectedCategory))
                selectedCategory = "";
            updateDropDownMenu(categories);
        }
    }
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();
    if(sessionStorage.getItem('activeUser')){
        DDMenu.append($(`
            <div class="menuPhotoLayout">
                 <img src="${JSON.parse(sessionStorage.getItem('activeUser')).Avatar}" alt="${JSON.parse(sessionStorage.getItem('activeUser')).Avatar}" class="UserAvatarXSmall">
                 <div>${JSON.parse(sessionStorage.getItem('activeUser')).Name}</div>
            </div>
        `));
        DDMenu.append($(`<div class="dropdown-divider"></div>`));
        if(JSON.parse(sessionStorage.getItem('activeUser')).Authorizations.readAccess == 3){
            DDMenu.append($(`
                <div class="dropdown-item menuItemLayout" id="gestionCmd">
                    <i class="menuIcon fa fa-users mx-2"></i> Gestion des Usagers
                </div>
            `));
            DDMenu.append($(`<div class="dropdown-divider"></div>`));
        }
    }
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    if (!sessionStorage.getItem("activeUser")) {
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="connectCmd">
                <i class="menuIcon fa fa-user mx-2"></i> Se Connecter
            </div>`));
    } else {
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="logoutCmd">
            <i class="menuIcon fa fa-user mx-2"></i> Se déconnecter
        </div>
        <div class="dropdown-item menuItemLayout" id="editCmd">
            <i class="menuIcon fa fa-pencil mx-2"></i> Modifier le profil
        </div>`
    ));
    }
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));
    $('#connectCmd').show();
    $('#logoutCmd').show();

    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $('#connectCmd').on("click", function () {
        showLoginForm();
    });
    $('#editCmd').on("click", function () {
        showCreateUserForm(JSON.parse(sessionStorage.getItem("activeUser")));
    });
    $('#logoutCmd').on("click", function () {
        Users_API.Logout(JSON.parse(sessionStorage.getItem("activeUser")).Id);
        showPosts();
    });
    $('#allCatCmd').on("click", async function () {
        selectedCategory = "";
        await showPosts(true);
        updateDropDownMenu();
    });
    $('#gestionCmd').on("click", function () {
        showGestionPage();
    });
    $('.category').on("click", async function () {
        selectedCategory = $(this).text().trim();
        await showPosts(true);
        updateDropDownMenu();
    });
    if (sessionStorage.getItem("activeUser")) {

        $('#logoutCmd').show();
    } else {
        $('#connectCmd').show();
    }
}
function attach_Posts_UI_Events_Callback() {

    linefeeds_to_Html_br(".postText");
    // attach icon command click event callback
    $(".editCmd").off();
    $(".editCmd").on("click", function () {
        showEditPostForm($(this).attr("postId"));
    });
    $(".deleteCmd").off();
    $(".deleteCmd").on("click", function () {
        showDeletePostForm($(this).attr("postId"));
    });
    $(".likeCmd").off();
    $(".likeCmd").on("click", function () {
        let postId = $(this).attr("postId");
        let user = JSON.parse(sessionStorage.getItem("activeUser"))
        addLike(user, postId);
    });


    $(".moreText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).show();
        $(`.lessText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('showExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('hideExtra');
    })
    $(".lessText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).hide();
        $(`.moreText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('hideExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('showExtra');
    })
}
function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        postsPanel.itemsPanel.append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}

function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

async function addLike(user, postId) {
    await Posts_API.Like({user : user, postId:postId});
}
/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////

function linefeeds_to_Html_br(selector) {
    $.each($(selector), function () {
        let postText = $(this);
        var str = postText.html();
        var regex = /[\r\n]/g;
        postText.html(str.replace(regex, "<br>"));
    })
}
function highlight(text, elem) {
    text = text.trim();
    if (text.length >= minKeywordLenth) {
        var innerHTML = elem.innerHTML;
        let startIndex = 0;

        while (startIndex < innerHTML.length) {
            var normalizedHtml = innerHTML.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var index = normalizedHtml.indexOf(text, startIndex);
            let highLightedText = "";
            if (index >= startIndex) {
                highLightedText = "<span class='highlight'>" + innerHTML.substring(index, index + text.length) + "</span>";
                innerHTML = innerHTML.substring(0, index) + highLightedText + innerHTML.substring(index + text.length);
                startIndex = index + highLightedText.length + 1;
            } else
                startIndex = innerHTML.length + 1;
        }
        elem.innerHTML = innerHTML;
    }
}
function highlightKeywords() {
    if (showKeywords) {
        let keywords = $("#searchKeys").val().split(' ');
        if (keywords.length > 0) {
            keywords.forEach(key => {
                let titles = document.getElementsByClassName('postTitle');
                Array.from(titles).forEach(title => {
                    highlight(key, title);
                })
                let texts = document.getElementsByClassName('postText');
                Array.from(texts).forEach(text => {
                    highlight(key, text);
                })
            })
        }
    }
}

//////////////////////// Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
    $('#commit').show();
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null)
            renderPostForm(Post);
        else
            showError("Post introuvable!");
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let post = response.data;
        if (post !== null) {
            let date = convertToFrenchDate(UTC_To_Local(post.Date));
            $("#form").append(`
                <div class="post" id="${post.Id}">
                <div class="postHeader">  ${post.Category} </div>
                <div class="postTitle ellipsis"> ${post.Title} </div>
                <img class="postImage" src='${post.Image}'/>
                <div class="postDate"> ${date} </div>
                <div class="postTextContainer showExtra">
                    <div class="postText">${post.Text}</div>
                </div>
            `);
            linefeeds_to_Html_br(".postText");
            // attach form buttons click event callback
            $('#commit').on("click", async function () {
                await Posts_API.Delete(post.Id);
                if (!Posts_API.error) {
                    await showPosts();
                }
                else {
                    console.log(Posts_API.currentHttpError)
                    showError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", async function () {
                await showPosts();
            });

        } else {
            showError("Post introuvable!");
        }
    } else
        showError(Posts_API.currentHttpError);
}
function newPost() {
    let Post = {};
    Post.Id = 0;
    Post.Title = "";
    Post.Text = "";
    Post.Image = "news-logo-upload.png";
    Post.Category = "";
    Post.UserId = "";
    Post.Likes = []
    return Post;
}
function renderPostForm(post = null) {
    let create = post == null;
    if (create) post = newPost();
    user = JSON.parse(sessionStorage.getItem('activeUser'));
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
             <input type="hidden" name="Date" value="${post.Date}"/>
             <input type="hidden" name="Likes" value="${post.Likes}"/>
            <label for="Category" class="form-label">Catégorie</label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control" 
                          name="Text" 
                          id="Text"
                          placeholder="Texte" 
                          rows="9"
                          required 
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='${create}' 
                     controlId='Image' 
                     imageSrc='${post.Image}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
    if (create) $("#keepDateControl").hide();

    initImageUploaders();
    initFormValidation(); // important do to after all html injection!

    $("#commit").click(function () {
        $("#commit").off();
        return $('#savePost').trigger("click");
    });
    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let post = getFormData($("#postForm"));
        user = JSON.parse(sessionStorage.getItem('activeUser'));
        post.User = user;
        console.log(user);
        if (post.Category != selectedCategory)
            selectedCategory = "";
        if (create || !('keepDate' in post))
            post.Date = Local_to_UTC(Date.now());
        delete post.keepDate;
        post = await Posts_API.Save(post, create);
        if (!Posts_API.error) {
            await showPosts();
            postsPanel.scrollToElem(post.Id);
        }
        else
            showError("Une erreur est survenue! ", Posts_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}
function renderVerificationForm(user) {
    let jsonUser = JSON.parse(user);

    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="verificationForm">
            <label for="Email" class="form-label"></label>
            <input 
                class="form-control"
                name="Verification" 
                id="Verification" 
                placeholder="Code de verification"
                required
                RequireMessage="Veuillez entrer le code de verificaiton"
                InvalidMessage="Code invalide"
            />
            <span id="verificationError"></span>
            <br>
            <input type="submit" value="Enregistrer" id="verify" class="btn btn-primary ">
            <hr>
        </form>`);
    $('#verificationForm').on("submit", async function (event) {
        let code = getFormData($("#verificationForm"));
        Users_API.Verify({ Id: jsonUser.Id, code: code.Verification });
    });
}
function newUser() {
    let User = {};
    User.Name = "";
    User.Email = "";
    User.Password = "";
    User.Avatar = "no-avatar.png";
    return User;
}
function renderLoginForm() {
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="loginForm">
            <label for="Email" class="form-label"></label>
            <input 
                class="form-control Email"
                name="Email" 
                id="Email" 
                placeholder="Courriel"
                required
                RequireMessage="Veuillez entrer un courriel"
                InvalidMessage="Le courriel n'a pas un format valide"
            />
            <span id="emailError"></span>
            <br>
             <input 
                type="password"
                class="form-control" 
                name="Password" 
                id="Password"
                placeholder="Mot de passe" 
                required 
                RequireMessage = 'Veuillez entrer un mot de passe'
            >
            <span id="passwordError"></span>
            <br>
            <input type="submit" value="Enregistrer" id="login" class="btn btn-primary ">
            <hr>
        <div id="createUser" class="btn btn-primary">Créer un compte</div>
        </form>
        
    `);

    //initFormValidation();

    $("#commit").click(function () {
        $("#commit").off();
        return $('#login').trigger("click");
    });
    $('#loginForm').on("submit", async function (event) {
        event.preventDefault();

        let token = null;
        let user = null;
        let loginInfo = getFormData($("#loginForm"));


        if (loginInfo.Email && loginInfo.Password) {
            Users_API.Login(loginInfo).then((reponse) => {
                console.log(reponse);
                for(res in reponse){
                    console.log(res);
                    switch(res){
                        case "error_description":
                            if(reponse.error_description == "This user email is not found."){
                                console.log(res.error_description);
                                $('#emailError').text(reponse.error_description);
                                $('#passwordError').text("");
                            }else if(reponse.error_description == "Wrong password."){
                                $('#passwordError').text(reponse.error_description);
                                $('#emailError').text("");
                            }else if(reponse.error_description == "User has been blocked."){
                                $('#emailError').text(reponse.error_description);
                                $('#passwordError').text("");
                            };
                        break;
                        case "Id":
                            token = reponse;
                            break;
                    }
                    break;
                }
                console.log(token);
                if (token) {
                    user = token.User;
                    sessionStorage.setItem("activeUser", JSON.stringify(user));
                    sessionStorage.setItem("activeToken", JSON.stringify(token));
                    if (user.VerifyCode != "verified") {
                        showVerificationForm();
                    } else {
                        showPosts();
                    }

                }
                
                initTimeout(300, ()=>{Users_API.Logout(JSON.parse(sessionStorage.getItem("activeUser"))); showPosts();});
            });
        } else if (!loginInfo.Email) {
            $("#emailError").append("Courriel invalide");
        } else if (!loginInfo.Password) {
            $("#passwordError").append("Mot de passe incorrecte");
        }

        // // if (!Users_API.error) {
        // //     console.log(user);
        // //     if(user.VerifyCode != "verified"){
        // //         showVerificationForm();
        // //     }else{
        // //         showPosts();
        // //     }
        // // }
        // else
        //     showError("Une erreur est survenue! ", Users_API.currentHttpError);
    });
    $("#createUser").on("click", async function () {
        await renderUserForm();
    });
    $('#cancel').on("click", async function () {
        //await showPosts();
    });
}
function renderUserForm(user = null) {
    let create = user == null;
    let requirePassword = "";
    if (create) {
        user = newUser();
        requirePassword= "required RequireMessage = 'les mots de passes ne correspondent pas'"
    }
    let idInput ="";
    if(!create){
        idInput = `<input name="Id" id="Id" type="hidden" value=${user.Id}`;
    }
    let valid=true;
    console.log(user);
    console.log(JSON.parse(sessionStorage.getItem("activeUser")));
    
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        
        <form class="form" id="userForm">
            ${idInput}
            <label for="Name" class="form-label">Nom </label>
            <input 
                class="form-control"
                name="Name"
                id="Nom"
                placeholder="Nom"
                required
                value="${user.Name}"
            />
            <div>
            <label for="Email" class="form-label">Email </label>
            <input 
                class="form-control Email MatchedInput"
                name="Email" 
                id="Email" 
                matchedInputId="Email"
                placeholder="Email"
                required
                RequireMessage="Veuillez entrer un courriel"
                InvalidMessage="Le courriel n'a pas un format valide"
                value="${user.Email}"
            />
            <input 
                class="form-control Email MatchedInput"
                name="EmailVerif" 
                matchedInputId="Email"
                placeholder="Verification"
                required
                RequireMessage="Veuillez entrer un courriel"
                InvalidMessage="Les courriels ne correspondent pas"
            />
            </div>
            <span id="emailError"></span>
            <div>
            <label for="Password" class="form-label">Mot de Passe</label>
             <input 
                type="password"
                class="form-control  MatchedInput" 
                name="Password" 
                id="Password"
                matchedInputId="Password"
                placeholder="Mot de passe" 
                ${requirePassword}
                </input>
             <input 
                type="password"
                class="form-control  MatchedInput" 
                name="PasswordVerif" 
                id="PasswordVerif"
                matchedInputId="Password"
                placeholder="Verification"
                </input>
            </div>
            <span id="passwordError"></span>
            <label class="form-label">Avatar</label>
            <div class='imageUploaderContainer' style="max-height:400px; max-width:400px; margin:auto;">
                <div class='imageUploader'  
                     newImage='${create}' 
                     controlId='Avatar' 
                     imageSrc='${user.Avatar}' 
                     value='${user.Avatar}'
                     waitingImage="Loading_icon.gif" >
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="saveUser" class="btn btn-primary display">
            <br>
            <div id="cancel" class="btn btn-primary display" style="background-color:slategrey; border-color:slategrey;"> Annuler </div>
            
        </form>
        <hr>
        <div id="deleteUser" class="btn btn-primary display" style="background-color:red; border-color:red;"> Effacer</div>
        
    `);
    if (create) $("#keepDateControl").hide();
    if (create) $("#deleteUser").hide();
    
    initImageUploaders();
    addConflictValidation(Users_API.API_URL()+"accounts", "Email", "saveUser");
    initFormValidation(); // important do to after all html injection!
    
    
    
    $('#userForm').on("submit", async function (event) {
        event.preventDefault();
        console.log(create);
        let user = getFormData($("#userForm"));
       

        
        if(valid){
            await Users_API.Save( user, create).then(async (thenUser)=>{
                if(!create){
                    sessionStorage.setItem("activeUser", JSON.stringify(thenUser));
                    console.log(thenUser);
                }
                    
            });
            showPosts();
        }
        
        
        if(Users_API.currentHttpError)
            showError("Une erreur est survenue! ", Users_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });

    $('#deleteUser').on("click", async function(){

        showDeleteConfirm(user);
    })
}

function renderDeleteConfirm(user){
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <h1 style="flex:1; justify-self:center;">Voulez-vous vraiment supprimer ce compte?</h1>
        <div id="deleteUser" class="btn btn-primary display" style="background-color:red; border-color:red;"> Effacer</div>
        <br><br>
        <div id="cancelDelete" class="btn btn-primary display" style="background-color:slategrey; border-color:red;"> Annuler</div>
    `);
    $("#cancelDelete").on("click", ()=>{
        showCreateUserForm(user);
    });
    $("#deleteUser").on("click", ()=>{
        Users_API.Delete(user).then(()=>{
            sessionStorage.removeItem("activeUser");
            sessionStorage.removeItem("activeToken");
        });
    });

}
function getFormData($form) {
    // prevent html injections
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    // grab data from all controls
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}
