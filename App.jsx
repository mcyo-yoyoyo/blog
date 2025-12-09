import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  setDoc
} from 'firebase/firestore';

// --- 全局配置与工具 ---

// 1. 获取环境提供的 Firebase 配置
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// 2. 初始化 Firebase 实例
let app, auth, db;
if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// 3. 简单的图标组件 (SVG)
const Icons = {
  Pen: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Link: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Project: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
};

// --- 核心 React 组件 ---

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts'); // 默认显示 Posts

  // 初始化认证
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
          setLoading(false);
      } else {
          setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // 渲染加载状态
  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">正在加载个人空间...</div>;
  }

  // 如果没有 Firebase 配置
  if (!firebaseConfig) {
    return <div className="p-10 text-center text-red-500">错误：未检测到 Firebase 配置。请确保在正确的环境中运行。</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-indigo-600 mr-8">我的个人空间</span>
              <div className="hidden md:flex space-x-4">
                <NavButton label="我的思考 (Posts)" active={activeTab === 'posts'} onClick={() => setActiveTab('posts')} />
                <NavButton label="知识库 (Knowledge)" active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} />
                <NavButton label="个人介绍 (About)" active={activeTab === 'about'} onClick={() => setActiveTab('about')} />
                <NavButton label="项目 (Projects)" active={activeTab === 'project'} onClick={() => setActiveTab('project')} />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">
                {user ? (user.isAnonymous ? '访客模式' : '管理员在线') : '未登录'}
              </span>
              {/* 仅用于演示：实际部署时可隐藏此按钮或用于注销 */}
              {user && !user.isAnonymous && (
                <button onClick={() => signOut(auth)} className="text-xs text-red-400 hover:text-red-600">退出</button>
              )}
            </div>
          </div>
          {/* 移动端导航 */}
          <div className="md:hidden flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
             <NavButton label="Posts" active={activeTab === 'posts'} onClick={() => setActiveTab('posts')} />
             <NavButton label="Knowledge" active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} />
             <NavButton label="About" active={activeTab === 'about'} onClick={() => setActiveTab('about')} />
             <NavButton label="Projects" active={activeTab === 'project'} onClick={() => setActiveTab('project')} />
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'posts' && <PostsModule user={user} />}
        {activeTab === 'knowledge' && <KnowledgeModule user={user} />}
        {activeTab === 'about' && <AboutModule user={user} />}
        {activeTab === 'project' && <ProjectsModule user={user} />} {/* 更改为 ProjectsModule */}
      </main>
      
      <footer className="text-center text-gray-400 py-8 text-sm border-t mt-12">
        © {new Date().getFullYear()} 个人品牌网站. 构建于 React & Firebase.
      </footer>
    </div>
  );
}

// --- 导航按钮组件 ---
function NavButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active 
          ? 'bg-indigo-100 text-indigo-700' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
}

// --- 1. Posts 模块 (博客/思考) ---
function PostsModule({ user }) {
  const [posts, setPosts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  // 表单状态
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState(''); // 媒体链接
  
  // *** 文件上传说明：由于环境限制，我们无法直接上传文件。
  // *** 请使用 mediaUrl 字段输入外部托管的图片或视频链接。
  const handleFileChange = (e) => {
    // 这是一个模拟的文件选择，实际上我们只能处理URL
    alert('提示：文件上传功能受限于当前环境，请使用下方输入框粘贴媒体的外部链接。');
  };

  // 监听数据
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Posts fetch error:", error);
    });
    return unsubscribe;
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) return alert("标题和内容不能为空");
    if (!user || user.isAnonymous) return alert("请以管理员身份登录后发布");
    
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), {
        title,
        content,
        mediaUrl,
        createdAt: serverTimestamp(),
        authorId: user.uid
      });
      setTitle(''); setContent(''); setMediaUrl(''); setIsEditing(false);
    } catch (err) {
      alert("发布失败: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('确定要删除这条内容吗？')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', id));
      } catch (error) {
        console.error("Delete error:", error);
        alert("删除失败，可能是权限不足");
      }
    }
  };

  // 简单的管理员检查：非匿名用户即视为管理员
  const canEdit = user && !user.isAnonymous;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">灵感与思考</h2>
          <p className="text-gray-500 mt-1">记录工作中的点滴感悟与创意火花</p>
        </div>
        {canEdit && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            {isEditing ? '取消发布' : <><Icons.Plus /> <span className="ml-1">写点什么</span></>}
          </button>
        )}
      </div>

      {/* 发布表单 */}
      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 animate-fade-in">
          <h3 className="text-lg font-bold mb-4">发布新内容</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              type="text" placeholder="标题：今天的灵感是什么？" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={title} onChange={e => setTitle(e.target.value)}
            />
            <textarea 
              placeholder="内容：详细描述你的想法..." rows="4"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={content} onChange={e => setContent(e.target.value)}
            />
            {/* 模拟文件选择，引导用户使用URL */}
            <div className="flex space-x-3">
              <label className="flex-shrink-0 cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-2 px-4 rounded-lg flex items-center transition">
                <Icons.Plus /> 
                <span className="ml-2 text-sm">选择媒体文件 (仅演示)</span>
                <input type="file" className="hidden" onChange={handleFileChange} />
              </label>
              <input 
                type="text" placeholder="媒体链接 (粘贴图片/视频的 URL)" 
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
              />
            </div>
            <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">发布</button>
          </form>
        </div>
      )}

      {/* 文章列表 */}
      <div className="space-y-6">
        {posts.map(post => (
          <article key={post.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-bold text-gray-800 mb-2">{post.title}</h3>
              {canEdit && (
                <button onClick={() => handleDelete(post.id)} className="text-gray-400 hover:text-red-500 p-1">
                  <Icons.Trash />
                </button>
              )}
            </div>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{post.content}</p>
            
            {post.mediaUrl && (
              <div className="mt-4 rounded-lg overflow-hidden bg-gray-100 max-h-96 flex justify-center">
                {/* 简单的图片/视频判断 */}
                {post.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                  <video src={post.mediaUrl} controls className="max-w-full max-h-full" />
                ) : (
                  <img 
                    src={post.mediaUrl} 
                    alt="Post media" 
                    className="object-contain max-h-96 w-full" 
                    onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/600x400/CCCCCC/333333?text=无法加载媒体"; }} 
                  />
                )}
              </div>
            )}
            
            <div className="mt-4 text-xs text-gray-400">
              发布于 {post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleString() : '刚刚'}
            </div>
          </article>
        ))}
        {posts.length === 0 && <div className="text-center text-gray-400 py-10">暂无内容，快来发布第一条想法吧！</div>}
      </div>
    </div>
  );
}

// --- 2. Knowledge 模块 (知识库) ---
function KnowledgeModule({ user }) {
  const [links, setLinks] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '', category: '未分类' });
  const [categories, setCategories] = useState(['未分类']);

  // *** 文件上传说明：由于环境限制，我们无法直接上传文件。
  // *** 请使用 url 字段输入外部托管的文件链接（PDF, Office 等）。
  const handleFileChange = (e) => {
    alert('提示：文件上传功能受限于当前环境，请使用下方输入框粘贴文件的外部链接。');
  };

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'knowledge'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLinks(data);
      // 提取所有分类
      const cats = new Set(['未分类']);
      data.forEach(item => { if(item.category) cats.add(item.category); });
      setCategories(Array.from(cats));
    }, (error) => {
      console.error("Knowledge fetch error:", error);
    });
    return unsubscribe;
  }, [user]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newLink.title || !newLink.url) return alert("标题和链接必填");
    if (!user || user.isAnonymous) return alert("请以管理员身份登录后添加");

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'knowledge'), {
        ...newLink,
        createdAt: serverTimestamp()
      });
      setNewLink({ title: '', url: '', category: '未分类' });
      setIsEditing(false);
    } catch (error) {
      alert("添加失败: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if(confirm('删除此条目？')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'knowledge', id));
      } catch(error) {
        alert("删除失败");
      }
    }
  };

  const canEdit = user && !user.isAnonymous;

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">个人知识库</h2>
          <p className="text-gray-500 mt-1">收藏有价值的链接、文章与资源</p>
        </div>
        {canEdit && (
          <button onClick={() => setIsEditing(!isEditing)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center">
            <Icons.Plus /> <span className="ml-1">添加资源</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 mb-8">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">标题</label>
              <input 
                className="w-full p-2 border rounded" placeholder="资源标题" 
                value={newLink.title} onChange={e => setNewLink({...newLink, title: e.target.value})}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">外部链接/文件URL</label>
              <div className="flex space-x-2">
                <input 
                  className="p-2 border rounded flex-1" placeholder="URL 链接 (支持各种文件格式的链接)" 
                  value={newLink.url} onChange={e => setNewLink({...newLink, url: e.target.value})}
                />
                 {/* 模拟文件选择，引导用户使用URL */}
                <label className="flex-shrink-0 cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-2 px-4 rounded-lg flex items-center transition text-sm">
                  <Icons.Plus />
                  <input type="file" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            </div>
            <div className="md:col-span-1 flex space-x-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">分类</label>
                <input 
                  className="w-full p-2 border rounded" placeholder="分类 (如: AI工具)" 
                  value={newLink.category} onChange={e => setNewLink({...newLink, category: e.target.value})}
                />
              </div>
              <button type="submit" className="px-4 py-2 h-10 bg-indigo-600 text-white rounded hover:bg-indigo-700">保存</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-8">
        {categories.map(cat => {
          const catLinks = links.filter(l => l.category === cat);
          if (catLinks.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-lg font-bold text-gray-700 mb-3 border-l-4 border-indigo-500 pl-3">{cat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {catLinks.map(link => (
                  <div key={link.id} className="group bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition flex justify-between items-center">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center flex-1 min-w-0">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full mr-3 group-hover:bg-indigo-600 group-hover:text-white transition">
                        <Icons.Link />
                      </div>
                      <div className="truncate">
                        <div className="font-medium text-gray-800 truncate">{link.title}</div>
                        <div className="text-xs text-gray-400 truncate">{link.url}</div>
                      </div>
                    </a>
                    {canEdit && (
                      <button onClick={() => handleDelete(link.id)} className="ml-2 text-gray-300 hover:text-red-500">
                        <Icons.Trash />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- 3. About Module (个人介绍 - 可编辑) ---
function AboutModule({ user }) {
  const initialContacts = [
    { id: 1, type: 'Email', value: 'email@example.com' },
    { id: 2, type: 'GitHub', value: 'github.com/your-profile' },
    { id: 3, type: 'WeChat', value: 'YourWeChatID' },
  ];

  const [profile, setProfile] = useState({
    name: '职场探索者',
    title: '行业专家 / 终身学习者',
    bio: '在这里写下您的个人简介。例如：拥有10年+行业经验，专注于...',
    contacts: initialContacts, // 更新为数组
  });
  const [isEditing, setIsEditing] = useState(false);
  const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'profile', 'main');

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // 确保 contacts 字段存在且是数组，如果不是，则使用默认值
        if (!data.contacts || !Array.isArray(data.contacts)) {
          data.contacts = initialContacts;
        }
        setProfile(data);
      }
    }, (error) => {
      console.error("Profile fetch error:", error);
    });
    return unsubscribe;
  }, [user]);

  const handleSave = async () => {
    if (!user || user.isAnonymous) return alert("请以管理员身份登录后保存");
    try {
      await setDoc(docRef, profile);
      setIsEditing(false);
    } catch(error) {
      alert("保存失败: " + error.message);
    }
  };

  const handleContactChange = (id, field, value) => {
    setProfile({
      ...profile,
      contacts: profile.contacts.map(contact => 
        contact.id === id ? { ...contact, [field]: value } : contact
      )
    });
  };

  const handleAddContact = () => {
    setProfile({
      ...profile,
      contacts: [...profile.contacts, { id: Date.now(), type: 'Social Media', value: '' }]
    });
  };

  const handleRemoveContact = (id) => {
    setProfile({
      ...profile,
      contacts: profile.contacts.filter(contact => contact.id !== id)
    });
  };

  const canEdit = user && !user.isAnonymous;

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <div className="text-center mb-8 relative">
        <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg">
          {profile.name[0]}
        </div>
        {canEdit && (
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className="absolute top-0 right-0 text-gray-400 hover:text-indigo-600 p-2"
            title="编辑资料"
          >
            <Icons.Pen />
          </button>
        )}
        
        {isEditing ? (
          <div className="space-y-4 text-left mt-4">
            <label className="block text-sm font-medium text-gray-700">姓名</label>
            <input className="w-full border p-2 rounded" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
            
            <label className="block text-sm font-medium text-gray-700">头衔/标签</label>
            <input className="w-full border p-2 rounded" value={profile.title} onChange={e => setProfile({...profile, title: e.target.value})} />
            
            <label className="block text-sm font-medium text-gray-700">简介</label>
            <textarea className="w-full border p-2 rounded" rows="4" value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})} />
            
            <label className="block text-sm font-medium text-gray-700 mt-4">联系方式 ({profile.contacts.length})</label>
            <div className="space-y-2 border p-3 rounded-lg bg-gray-50">
              {profile.contacts.map(contact => (
                <div key={contact.id} className="flex space-x-2">
                  <input 
                    className="w-1/3 border p-2 rounded" 
                    placeholder="类型 (Email, Github...)" 
                    value={contact.type} 
                    onChange={e => handleContactChange(contact.id, 'type', e.target.value)}
                  />
                  <input 
                    className="flex-1 border p-2 rounded" 
                    placeholder="值" 
                    value={contact.value} 
                    onChange={e => handleContactChange(contact.id, 'value', e.target.value)}
                  />
                  <button 
                    type="button" 
                    onClick={() => handleRemoveContact(contact.id)} 
                    className="p-2 text-red-400 hover:text-red-600"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              ))}
              <button 
                type="button" 
                onClick={handleAddContact} 
                className="w-full text-indigo-600 border border-indigo-200 py-1 rounded hover:bg-indigo-50 text-sm flex items-center justify-center mt-2"
              >
                <Icons.Plus /> <span className="ml-1">添加新联系方式</span>
              </button>
            </div>

            <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">保存资料</button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900">{profile.name}</h1>
            <p className="text-indigo-600 font-medium mt-1">{profile.title}</p>
            <div className="mt-6 text-gray-600 leading-relaxed whitespace-pre-wrap text-left bg-gray-50 p-6 rounded-xl">
              {profile.bio}
            </div>
            <div className="mt-8 pt-6 border-t flex flex-wrap justify-center gap-4 text-gray-500">
              {profile.contacts.map(contact => (
                <div key={contact.id} className="flex items-center bg-gray-100 px-3 py-1 rounded-full text-sm">
                  <span className="font-semibold text-gray-700 mr-2">{contact.type}:</span>
                  <a href={contact.type.toLowerCase() === 'email' ? `mailto:${contact.value}` : contact.value} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 truncate max-w-xs">
                    {contact.value}
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- 4. Projects 模块 (项目管理) ---
function ProjectsModule({ user }) {
  const [projects, setProjects] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProject, setCurrentProject] = useState(null); // 用于编辑现有项目

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('进行中');

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Projects fetch error:", error);
    });
    return unsubscribe;
  }, [user]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setLink(''); setStatus('进行中'); setCurrentProject(null);
  };

  const handleStartEdit = (project = null) => {
    if (project) {
      setCurrentProject(project);
      setTitle(project.title);
      setDescription(project.description);
      setLink(project.link || '');
      setStatus(project.status || '进行中');
    } else {
      resetForm();
    }
    setIsEditing(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description) return alert("标题和描述不能为空");
    if (!user || user.isAnonymous) return alert("请以管理员身份登录后操作");

    const projectData = {
      title,
      description,
      link,
      status,
    };

    try {
      if (currentProject) {
        // 更新现有项目
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', currentProject.id), projectData);
      } else {
        // 添加新项目
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), {
          ...projectData,
          createdAt: serverTimestamp(),
          authorId: user.uid
        });
      }
      setIsEditing(false);
      resetForm();
    } catch (err) {
      alert("操作失败: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('确定要删除这个项目吗？')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id));
      } catch (error) {
        alert("删除失败");
      }
    }
  };

  const canEdit = user && !user.isAnonymous;
  const statusColors = {
    '进行中': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    '已完成': 'bg-green-100 text-green-800 border-green-300',
    '搁置': 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">项目与作品集</h2>
          <p className="text-gray-500 mt-1">展示您的核心项目、进度与成果</p>
        </div>
        {canEdit && (
          <button 
            onClick={() => handleStartEdit()}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Icons.Plus /> <span className="ml-1">创建新项目</span>
          </button>
        )}
      </div>

      {/* 项目编辑/创建表单 */}
      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 animate-fade-in">
          <h3 className="text-lg font-bold mb-4">{currentProject ? '编辑项目' : '创建新项目'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              type="text" placeholder="项目名称" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={title} onChange={e => setTitle(e.target.value)}
            />
            <textarea 
              placeholder="项目描述：目标、技术栈、成果等..." rows="3"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={description} onChange={e => setDescription(e.target.value)}
            />
            <div className="flex space-x-4">
              <input 
                type="url" placeholder="项目链接 (Github/Demo URL)" 
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                value={link} onChange={e => setLink(e.target.value)}
              />
              <select 
                className="w-40 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={status} onChange={e => setStatus(e.target.value)}
              >
                <option value="进行中">进行中</option>
                <option value="已完成">已完成</option>
                <option value="搁置">搁置</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => { setIsEditing(false); resetForm(); }} className="py-2 px-4 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
              <button type="submit" className="py-2 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                {currentProject ? '保存修改' : '创建项目'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 项目列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map(project => (
          <div key={project.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-gray-800">{project.title}</h3>
                <span className={`px-3 py-1 text-xs font-medium rounded-full border ${statusColors[project.status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                  {project.status}
                </span>
              </div>
              <p className="text-gray-600 mb-4 line-clamp-3">{project.description}</p>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              {project.link ? (
                <a 
                  href={project.link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Icons.Link /> <span className="ml-1">查看项目</span>
                </a>
              ) : (
                <span className="text-sm text-gray-400 flex items-center"><Icons.Link /> <span className="ml-1">无外部链接</span></span>
              )}
              {canEdit && (
                <div className="flex space-x-2">
                  <button onClick={() => handleStartEdit(project)} className="text-gray-400 hover:text-indigo-500 p-1" title="编辑">
                    <Icons.Pen />
                  </button>
                  <button onClick={() => handleDelete(project.id)} className="text-gray-400 hover:text-red-500 p-1" title="删除">
                    <Icons.Trash />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {projects.length === 0 && <div className="md:col-span-2 text-center text-gray-400 py-10">暂无项目，快来展示您的作品吧！</div>}
      </div>
    </div>
  );
}
