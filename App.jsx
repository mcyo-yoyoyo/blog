<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>个人品牌与知识库</title>
    <!-- 引入 Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* 隐藏滚动条但允许滚动 */
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body class="bg-gray-50 font-sans text-gray-800">

    <div id="root">
        <!-- 应用内容将渲染在这里 -->
        <div class="flex items-center justify-center h-screen text-gray-500">正在初始化应用...</div>
    </div>

    <!-- 1. 引入 Firebase SDK (使用 Script Tag 解决 Dynamic Require 错误) -->
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
        import { 
            getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, 
            query, orderBy, serverTimestamp, setDoc, getDoc 
        } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

        // --- 全局配置与工具 ---
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        let app, auth, db, userId = null, canEdit = false;
        let activeTab = 'posts';
        let user = null;
        const initialProfile = {
            name: '职场探索者',
            title: '行业专家 / 终身学习者',
            bio: '在这里写下您的个人简介。例如：拥有10年+行业经验，专注于...',
            contacts: [
                { id: 1, type: 'Email', value: 'email@example.com' },
                { id: 2, type: 'GitHub', value: 'github.com/your-profile' },
            ],
        };

        // --- 初始化 Firebase ---
        const initFirebase = async () => {
            if (!firebaseConfig) {
                console.error("Firebase 配置缺失。");
                document.getElementById('root').innerHTML = '<div class="p-10 text-center text-red-500 bg-red-50 rounded-lg m-4">错误：Firebase 配置未初始化。</div>';
                return;
            }

            try {
                app = initializeApp(firebaseConfig);
                auth = getAuth(app);
                db = getFirestore(app);

                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }

                onAuthStateChanged(auth, (currentUser) => {
                    user = currentUser;
                    userId = user?.uid || crypto.randomUUID();
                    canEdit = user && !user.isAnonymous;
                    renderApp(); // 认证状态改变后重新渲染
                });

            } catch (e) {
                console.error("Firebase 初始化或认证失败:", e);
                document.getElementById('root').innerHTML = `<div class="p-10 text-center text-red-500 bg-red-50 rounded-lg m-4">Firebase 错误: ${e.message}</div>`;
            }
        };

        // --- 简单的图标函数 (SVG) ---
        const Icons = {
            Pen: () => `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>`,
            Trash: () => `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
            Plus: () => `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>`,
            Link: () => `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>`,
        };

        // --- 组件渲染函数 ---

        // 导航栏按钮
        const NavButton = (label, tabName) => `
            <button
                onclick="setActiveTab('${tabName}')"
                class="px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tabName 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }"
            >
                ${label}
            </button>
        `;

        // 1. Posts 模块
        let posts = [];
        let isEditingPost = false;
        let postForm = { title: '', content: '', mediaUrl: '' };
        
        const listenToPosts = () => {
            if (!db) return;
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), orderBy('createdAt', 'desc'));
            onSnapshot(q, (snapshot) => {
                posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                renderApp(); // 数据更新后重新渲染
            }, (error) => {
                console.error("Posts fetch error:", error);
            });
        };

        const handlePostSubmit = async (e) => {
            e.preventDefault();
            if (!postForm.title || !postForm.content) return console.error("标题和内容不能为空");
            if (!canEdit) return console.error("权限不足，无法发布");
            
            try {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), {
                    ...postForm,
                    createdAt: serverTimestamp(),
                    authorId: userId
                });
                postForm = { title: '', content: '', mediaUrl: '' };
                isEditingPost = false;
                renderApp();
            } catch (err) {
                console.error("发布失败: ", err);
            }
        };

        const handlePostDelete = async (id) => {
            if (window.confirm('确定要删除这条内容吗？')) {
                try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', id));
                } catch (error) {
                    console.error("Delete error:", error);
                }
            }
        };

        const renderPostsModule = () => `
            <div class="space-y-8">
                <div class="flex justify-between items-end border-b pb-4">
                    <div>
                        <h2 class="text-3xl font-bold text-gray-800">灵感与思考</h2>
                        <p class="text-gray-500 mt-1">记录工作中的点滴感悟与创意火花</p>
                    </div>
                    ${canEdit ? `
                        <button 
                            onclick="togglePostEditing()"
                            class="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
                        >
                            ${isEditingPost ? '取消发布' : Icons.Plus() + '<span class="ml-1">写点什么</span>'}
                        </button>
                    ` : ''}
                </div>

                <!-- 发布表单 -->
                ${isEditingPost ? `
                    <div class="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 animate-fade-in">
                        <h3 class="text-lg font-bold mb-4">发布新内容</h3>
                        <form onsubmit="handlePostSubmit(event)" class="space-y-4">
                            <input 
                                type="text" placeholder="标题：今天的灵感是什么？" 
                                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                value="${postForm.title}" oninput="updatePostForm('title', this.value)"
                            />
                            <textarea 
                                placeholder="内容：详细描述你的想法..." rows="4"
                                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                oninput="updatePostForm('content', this.value)"
                            >${postForm.content}</textarea>
                            <div class="flex space-x-3">
                                <input 
                                    type="text" placeholder="媒体链接 (粘贴图片/视频的 URL)" 
                                    class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                    value="${postForm.mediaUrl}" oninput="updatePostForm('mediaUrl', this.value)"
                                />
                            </div>
                            <button type="submit" class="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-md">发布</button>
                        </form>
                    </div>
                ` : ''}

                <!-- 文章列表 -->
                <div class="space-y-6">
                    ${posts.length === 0 ? `<div class="text-center text-gray-400 py-10">暂无内容，快来发布第一条想法吧！</div>` : posts.map(post => {
                        const date = post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleString() : '刚刚';
                        const mediaHtml = post.mediaUrl ? `
                            <div class="mt-4 rounded-lg overflow-hidden bg-gray-100 max-h-96 flex justify-center border border-gray-200">
                                ${post.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? 
                                    `<video src="${post.mediaUrl}" controls class="max-w-full max-h-full"></video>` : 
                                    `<img 
                                        src="${post.mediaUrl}" 
                                        alt="Post media" 
                                        class="object-contain max-h-96 w-full" 
                                        onerror="this.onerror=null;this.src='https://placehold.co/600x400/CCCCCC/333333?text=无法加载媒体';" 
                                    />`
                                }
                            </div>
                        ` : '';
                        
                        return `
                            <article class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                                <div class="flex justify-between items-start">
                                    <h3 class="text-xl font-bold text-gray-800 mb-2">${post.title}</h3>
                                    ${canEdit ? `
                                        <button onclick="handlePostDelete('${post.id}')" class="text-gray-400 hover:text-red-500 p-1">
                                            ${Icons.Trash()}
                                        </button>
                                    ` : ''}
                                </div>
                                <p class="text-gray-600 whitespace-pre-wrap leading-relaxed">${post.content}</p>
                                ${mediaHtml}
                                <div class="mt-4 text-xs text-gray-400">
                                    发布于 ${date}
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // 全局函数用于Posts
        window.setActiveTab = (tabName) => {
            activeTab = tabName;
            renderApp();
        };

        window.togglePostEditing = () => {
            isEditingPost = !isEditingPost;
            renderApp();
        };

        window.updatePostForm = (key, value) => {
            postForm[key] = value;
            // 不需要立即渲染，因为输入框会直接更新
        };

        window.handlePostSubmit = handlePostSubmit;
        window.handlePostDelete = handlePostDelete;
        
        // 2. Knowledge 模块
        let links = [];
        let isEditingKnowledge = false;
        let newLink = { title: '', url: '', category: '未分类' };
        
        const listenToKnowledge = () => {
            if (!db) return;
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'knowledge'), orderBy('createdAt', 'desc'));
            onSnapshot(q, (snapshot) => {
                links = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                renderApp();
            }, (error) => {
                console.error("Knowledge fetch error:", error);
            });
        };

        const handleKnowledgeAdd = async (e) => {
            e.preventDefault();
            if (!newLink.title || !newLink.url) return console.error("标题和链接必填");
            if (!canEdit) return console.error("权限不足，无法添加");

            try {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'knowledge'), {
                    ...newLink,
                    createdAt: serverTimestamp()
                });
                newLink = { title: '', url: '', category: '未分类' };
                isEditingKnowledge = false;
                renderApp();
            } catch (error) {
                console.error("添加失败: ", error);
            }
        };

        const handleKnowledgeDelete = async (id) => {
            if(window.confirm('删除此条目？')) {
                try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'knowledge', id));
                } catch(error) {
                    console.error("删除失败: ", error);
                }
            }
        };

        const renderKnowledgeModule = () => {
            const cats = new Set(['未分类']);
            links.forEach(item => { if(item.category) cats.add(item.category); });
            const categories = Array.from(cats);
            
            return `
                <div>
                    <div class="flex justify-between items-end mb-6">
                        <div>
                            <h2 class="text-3xl font-bold text-gray-800">个人知识库</h2>
                            <p class="text-gray-500 mt-1">收藏有价值的链接、文章与资源</p>
                        </div>
                        ${canEdit ? `
                            <button onclick="toggleKnowledgeEditing()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center shadow-md">
                                ${Icons.Plus()} <span class="ml-1">添加资源</span>
                            </button>
                        ` : ''}
                    </div>

                    ${isEditingKnowledge ? `
                        <div class="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 mb-8">
                            <form onsubmit="handleKnowledgeAdd(event)" class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div class="md:col-span-1">
                                    <label class="block text-sm font-medium text-gray-700">标题</label>
                                    <input 
                                        class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" placeholder="资源标题" 
                                        value="${newLink.title}" oninput="updateKnowledgeForm('title', this.value)"
                                    />
                                </div>
                                <div class="md:col-span-2">
                                    <label class="block text-sm font-medium text-gray-700">外部链接/文件URL</label>
                                    <input 
                                        class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" placeholder="URL 链接" 
                                        value="${newLink.url}" oninput="updateKnowledgeForm('url', this.value)"
                                    />
                                </div>
                                <div class="md:col-span-1 flex space-x-2 items-end">
                                    <div class="flex-1">
                                        <label class="block text-sm font-medium text-gray-700">分类</label>
                                        <input 
                                            class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" placeholder="分类 (如: AI工具)" 
                                            value="${newLink.category}" oninput="updateKnowledgeForm('category', this.value)"
                                        />
                                    </div>
                                    <button type="submit" class="px-4 py-2 h-10 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-md">保存</button>
                                </div>
                            </form>
                        </div>
                    ` : ''}

                    <div class="space-y-8">
                        ${categories.map(cat => {
                            const catLinks = links.filter(l => l.category === cat);
                            if (catLinks.length === 0) return '';
                            return `
                                <div>
                                    <h3 class="text-xl font-bold text-gray-700 mb-3 border-l-4 border-indigo-500 pl-3">${cat}</h3>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        ${catLinks.map(link => `
                                            <div class="group bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition flex justify-between items-center">
                                                <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="flex items-center flex-1 min-w-0">
                                                    <div class="p-2 bg-indigo-50 text-indigo-600 rounded-full mr-3 group-hover:bg-indigo-600 group-hover:text-white transition">
                                                        ${Icons.Link()}
                                                    </div>
                                                    <div class="truncate">
                                                        <div class="font-medium text-gray-800 truncate">${link.title}</div>
                                                        <div class="text-xs text-gray-400 truncate">${link.url}</div>
                                                    </div>
                                                </a>
                                                ${canEdit ? `
                                                    <button onclick="handleKnowledgeDelete('${link.id}')" class="ml-2 text-gray-300 hover:text-red-500">
                                                        ${Icons.Trash()}
                                                    </button>
                                                ` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        };

        // 全局函数用于Knowledge
        window.toggleKnowledgeEditing = () => {
            isEditingKnowledge = !isEditingKnowledge;
            renderApp();
        };

        window.updateKnowledgeForm = (key, value) => {
            newLink[key] = value;
        };
        
        window.handleKnowledgeAdd = handleKnowledgeAdd;
        window.handleKnowledgeDelete = handleKnowledgeDelete;

        // 3. About 模块
        let profile = {...initialProfile};
        let isEditingAbout = false;
        const profileDocRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'profile', 'main');

        const fetchProfile = async () => {
            if (!db) return;
            try {
                const docSnap = await getDoc(profileDocRef());
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (!data.contacts || !Array.isArray(data.contacts)) {
                        data.contacts = initialProfile.contacts;
                    }
                    profile = data;
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            }
            renderApp();
        };

        const handleAboutSave = async () => {
            if (!canEdit) return console.error("权限不足，无法保存");
            try {
                const cleanedProfile = {
                    ...profile,
                    contacts: profile.contacts.filter(c => c.value && c.type)
                };
                await setDoc(profileDocRef(), cleanedProfile);
                profile = cleanedProfile;
                isEditingAbout = false;
                renderApp();
            } catch(error) {
                console.error("保存失败: ", error);
            }
        };

        const handleContactChange = (id, field, value) => {
            profile.contacts = profile.contacts.map(contact => 
                contact.id === id ? { ...contact, [field]: value } : contact
            );
            // 立即渲染，确保输入框内容更新
            renderApp();
        };

        const handleAddContact = () => {
            profile.contacts.push({ id: Date.now(), type: '', value: '' });
            renderApp();
        };

        const handleRemoveContact = (id) => {
            profile.contacts = profile.contacts.filter(contact => contact.id !== id);
            renderApp();
        };

        const renderAboutModule = () => {
            const contactInputs = profile.contacts.map(contact => `
                <div key="${contact.id}" class="flex space-x-2">
                    <input 
                        class="w-1/3 border border-gray-300 p-2 rounded" 
                        placeholder="类型 (Email, Github...)" 
                        value="${contact.type}" 
                        oninput="handleContactChange(${contact.id}, 'type', this.value)"
                    />
                    <input 
                        class="flex-1 border border-gray-300 p-2 rounded" 
                        placeholder="值" 
                        value="${contact.value}" 
                        oninput="handleContactChange(${contact.id}, 'value', this.value)"
                    />
                    <button 
                        type="button" 
                        onclick="handleRemoveContact(${contact.id})" 
                        class="p-2 text-red-400 hover:text-red-600"
                    >
                        ${Icons.Trash()}
                    </button>
                </div>
            `).join('');


            return `
                <div class="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                    <div class="text-center mb-8 relative">
                        <div class="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg">
                            ${profile.name[0]}
                        </div>
                        ${canEdit ? `
                            <button 
                                onclick="toggleAboutEditing(true)" 
                                class="absolute top-0 right-0 text-gray-400 hover:text-indigo-600 p-2"
                                title="编辑资料"
                            >
                                ${isEditingAbout ? '' : Icons.Pen()}
                            </button>
                        ` : ''}
                        
                        ${isEditingAbout ? `
                            <div class="space-y-4 text-left mt-4">
                                <label class="block text-sm font-medium text-gray-700">姓名</label>
                                <input class="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500" value="${profile.name}" oninput="updateProfile('name', this.value)" />
                                
                                <label class="block text-sm font-medium text-gray-700">头衔/标签</label>
                                <input class="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500" value="${profile.title}" oninput="updateProfile('title', this.value)" />
                                
                                <label class="block text-sm font-medium text-gray-700">简介</label>
                                <textarea class="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500" rows="4" oninput="updateProfile('bio', this.value)">${profile.bio}</textarea>
                                
                                <label class="block text-sm font-medium text-gray-700 mt-4">联系方式 (${profile.contacts.length})</label>
                                <div class="space-y-2 border p-3 rounded-lg bg-gray-50">
                                    ${contactInputs}
                                    <button 
                                        type="button" 
                                        onclick="handleAddContact()" 
                                        class="w-full text-indigo-600 border border-indigo-200 py-1 rounded hover:bg-indigo-50 text-sm flex items-center justify-center mt-2"
                                    >
                                        ${Icons.Plus()} <span class="ml-1">添加新联系方式</span>
                                    </button>
                                </div>

                                <button onclick="handleAboutSave()" class="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 shadow-md">保存资料</button>
                                <button onclick="toggleAboutEditing(false)" class="w-full mt-2 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400">取消</button>
                            </div>
                        ` : `
                            <h1 class="text-3xl font-bold text-gray-900">${profile.name}</h1>
                            <p class="text-indigo-600 font-medium mt-1">${profile.title}</p>
                            <div class="mt-6 text-gray-600 leading-relaxed whitespace-pre-wrap text-left bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-inner">
                                ${profile.bio}
                            </div>
                            <div class="mt-8 pt-6 border-t flex flex-wrap justify-center gap-4 text-gray-500">
                                ${profile.contacts.map(contact => `
                                    <div class="flex items-center bg-gray-100 px-3 py-1 rounded-full text-sm">
                                        <span class="font-semibold text-gray-700 mr-2">${contact.type}:</span>
                                        <a href="${contact.type.toLowerCase() === 'email' ? 'mailto:' + contact.value : contact.value}" target="_blank" rel="noopener noreferrer" class="hover:text-indigo-600 truncate max-w-xs">
                                            ${contact.value}
                                        </a>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;
        };

        // 全局函数用于About
        window.toggleAboutEditing = (shouldFetch = false) => {
            isEditingAbout = !isEditingAbout;
            if (!isEditingAbout && shouldFetch) fetchProfile();
            renderApp();
        };
        window.updateProfile = (key, value) => {
            profile[key] = value;
            renderApp(); // 立即渲染以更新输入框
        };
        window.handleContactChange = handleContactChange;
        window.handleAddContact = handleAddContact;
        window.handleRemoveContact = handleRemoveContact;
        window.handleAboutSave = handleAboutSave;


        // 4. Projects 模块
        let projects = [];
        let isEditingProject = false;
        let currentProject = null; 
        let projectForm = { title: '', description: '', link: '', status: '进行中' };
        
        const listenToProjects = () => {
            if (!db) return;
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), orderBy('createdAt', 'desc'));
            onSnapshot(q, (snapshot) => {
                projects = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                renderApp();
            }, (error) => {
                console.error("Projects fetch error:", error);
            });
        };

        const handleProjectStartEdit = (project = null) => {
            if (project) {
                currentProject = project;
                projectForm = { title: project.title, description: project.description, link: project.link || '', status: project.status || '进行中' };
            } else {
                currentProject = null;
                projectForm = { title: '', description: '', link: '', status: '进行中' };
            }
            isEditingProject = true;
            renderApp();
        };

        const handleProjectSubmit = async (e) => {
            e.preventDefault();
            if (!projectForm.title || !projectForm.description) return console.error("标题和描述不能为空");
            if (!canEdit) return console.error("权限不足，无法操作");

            const projectData = {
                title: projectForm.title,
                description: projectForm.description,
                link: projectForm.link,
                status: projectForm.status,
            };

            try {
                if (currentProject) {
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', currentProject.id), projectData);
                } else {
                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), {
                        ...projectData,
                        createdAt: serverTimestamp(),
                        authorId: userId
                    });
                }
                isEditingProject = false;
                currentProject = null;
                projectForm = { title: '', description: '', link: '', status: '进行中' };
                renderApp();
            } catch (err) {
                console.error("操作失败: ", err);
            }
        };

        const handleProjectDelete = async (id) => {
            if (window.confirm('确定要删除这个项目吗？')) {
                try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id));
                } catch (error) {
                    console.error("删除失败: ", error);
                }
            }
        };

        const renderProjectsModule = () => {
            const statusColors = {
                '进行中': 'bg-yellow-100 text-yellow-800 border-yellow-300',
                '已完成': 'bg-green-100 text-green-800 border-green-300',
                '搁置': 'bg-red-100 text-red-800 border-red-300',
            };

            const projectFormHtml = isEditingProject ? `
                <div class="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 animate-fade-in">
                    <h3 class="text-lg font-bold mb-4">${currentProject ? '编辑项目' : '创建新项目'}</h3>
                    <form onsubmit="handleProjectSubmit(event)" class="space-y-4">
                        <input 
                            type="text" placeholder="项目名称" 
                            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value="${projectForm.title}" oninput="updateProjectForm('title', this.value)"
                        />
                        <textarea 
                            placeholder="项目描述：目标、技术栈、成果等..." rows="3"
                            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            oninput="updateProjectForm('description', this.value)"
                        >${projectForm.description}</textarea>
                        <div class="flex space-x-4">
                            <input 
                                type="url" placeholder="项目链接 (Github/Demo URL)" 
                                class="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                                value="${projectForm.link}" oninput="updateProjectForm('link', this.value)"
                            />
                            <select 
                                class="w-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                onchange="updateProjectForm('status', this.value)"
                            >
                                <option value="进行中" ${projectForm.status === '进行中' ? 'selected' : ''}>进行中</option>
                                <option value="已完成" ${projectForm.status === '已完成' ? 'selected' : ''}>已完成</option>
                                <option value="搁置" ${projectForm.status === '搁置' ? 'selected' : ''}>搁置</option>
                            </select>
                        </div>
                        <div class="flex justify-end space-x-2">
                            <button type="button" onclick="cancelProjectEditing()" class="py-2 px-4 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
                            <button type="submit" class="py-2 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-md">
                                ${currentProject ? '保存修改' : '创建项目'}
                            </button>
                        </div>
                    </form>
                </div>
            ` : '';

            const projectListHtml = projects.length === 0 ? 
                `<div class="md:col-span-2 text-center text-gray-400 py-10">暂无项目，快来展示您的作品吧！</div>` : 
                projects.map(project => `
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="text-xl font-bold text-gray-800">${project.title}</h3>
                                <span class="px-3 py-1 text-xs font-medium rounded-full border ${statusColors[project.status] || 'bg-gray-100 text-gray-800 border-gray-300'}">
                                    ${project.status}
                                </span>
                            </div>
                            <p class="text-gray-600 mb-4 line-clamp-3">${project.description}</p>
                        </div>

                        <div class="flex justify-between items-center pt-3 border-t">
                            ${project.link ? `
                                <a 
                                    href="${project.link}" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    ${Icons.Link()} <span class="ml-1">查看项目</span>
                                </a>
                            ` : `
                                <span class="text-sm text-gray-400 flex items-center">${Icons.Link()} <span class="ml-1">无外部链接</span></span>
                            `}
                            ${canEdit ? `
                                <div class="flex space-x-2">
                                    <button onclick="handleProjectStartEdit({ id: '${project.id}', title: '${project.title}', description: '${project.description.replace(/'/g, "\\'")}', link: '${project.link || ''}', status: '${project.status || '进行中'}' })" class="text-gray-400 hover:text-indigo-500 p-1" title="编辑">
                                        ${Icons.Pen()}
                                    </button>
                                    <button onclick="handleProjectDelete('${project.id}')" class="text-gray-400 hover:text-red-500 p-1" title="删除">
                                        ${Icons.Trash()}
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('');

            return `
                <div class="space-y-8">
                    <div class="flex justify-between items-end border-b pb-4">
                        <div>
                            <h2 class="text-3xl font-bold text-gray-800">项目与作品集</h2>
                            <p class="text-gray-500 mt-1">展示您的核心项目、进度与成果</p>
                        </div>
                        ${canEdit ? `
                            <button 
                                onclick="handleProjectStartEdit()"
                                class="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
                            >
                                ${Icons.Plus()} <span class="ml-1">创建新项目</span>
                            </button>
                        ` : ''}
                    </div>
                    ${projectFormHtml}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${projectListHtml}</div>
                </div>
            `;
        };

        // 全局函数用于Projects
        window.handleProjectStartEdit = handleProjectStartEdit;
        window.cancelProjectEditing = () => { isEditingProject = false; currentProject = null; projectForm = { title: '', description: '', link: '', status: '进行中' }; renderApp(); };
        window.updateProjectForm = (key, value) => { projectForm[key] = value; };
        window.handleProjectSubmit = handleProjectSubmit;
        window.handleProjectDelete = handleProjectDelete;
        
        
        // --- 主渲染函数 ---
        const renderApp = () => {
            const root = document.getElementById('root');
            if (!user) {
                 root.innerHTML = '<div class="flex items-center justify-center h-screen text-gray-500">正在等待认证...</div>';
                 return;
            }

            let moduleContent = '';
            switch (activeTab) {
                case 'posts':
                    moduleContent = renderPostsModule();
                    break;
                case 'knowledge':
                    moduleContent = renderKnowledgeModule();
                    break;
                case 'about':
                    // 确保在渲染 About 模块前获取最新数据
                    if (!isEditingAbout) fetchProfile();
                    moduleContent = renderAboutModule();
                    break;
                case 'project':
                    moduleContent = renderProjectsModule();
                    break;
            }
            
            const authStatus = user ? (canEdit ? '管理员在线' : `用户 ID: ${user.uid.substring(0, 8)}...`) : '未登录';
            const logoutButton = user && !user.isAnonymous ? 
                `<button onclick="signOut(auth)" class="text-xs text-red-400 hover:text-red-600 ml-2 border p-1 rounded">退出</button>` : '';

            root.innerHTML = `
                <div class="min-h-screen">
                    <nav class="bg-white shadow sticky top-0 z-50">
                        <div class="max-w-5xl mx-auto px-4">
                            <div class="flex justify-between h-16">
                                <div class="flex items-center">
                                    <span class="text-xl font-bold text-indigo-600 mr-8">我的个人空间</span>
                                    <div class="hidden md:flex space-x-4">
                                        ${NavButton("我的思考 (Posts)", 'posts')}
                                        ${NavButton("知识库 (Knowledge)", 'knowledge')}
                                        ${NavButton("个人介绍 (About)", 'about')}
                                        ${NavButton("项目 (Projects)", 'project')}
                                    </div>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class="text-xs text-gray-400">${authStatus}</span>
                                    ${logoutButton}
                                </div>
                            </div>
                            <div class="md:hidden flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                                ${NavButton("Posts", 'posts')}
                                ${NavButton("Knowledge", 'knowledge')}
                                ${NavButton("About", 'about')}
                                ${NavButton("Projects", 'project')}
                            </div>
                        </div>
                    </nav>

                    <main class="max-w-5xl mx-auto px-4 py-8">
                        ${moduleContent}
                    </main>
                    
                    <footer class="text-center text-gray-400 py-8 text-sm border-t mt-12">
                        © ${new Date().getFullYear()} 个人品牌网站. 构建于 JavaScript & Firebase.
                    </footer>
                </div>
            `;
        };
        
        // --- 启动应用 ---
        window.onload = () => {
            initFirebase();
            // 在认证完成后，onAuthStateChanged 会触发 renderApp
            // 并在 renderApp 内部，会触发各个模块的 onSnapshot 监听器
            if (db) {
                listenToPosts();
                listenToKnowledge();
                listenToProjects();
            }
        };

    </script>
</body>
</html>
