// App.jsx
const { useState, useEffect, useRef } = React;

// 全局配置（可从 window 获取，或硬编码）
const appId = 'default-app-id';
const firebaseConfig = {
  // 👇 替换为你自己的 Firebase 配置
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

let db, auth;

function App() {
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [initError, setInitError] = useState(null);

  // 初始化 Firebase
  useEffect(() => {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      auth = firebase.auth();
      db = firebase.firestore();

      const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
        if (!currentUser) {
          try {
            await auth.signInAnonymously();
          } catch (error) {
            console.error("匿名登录失败:", error);
            setInitError("初始化失败，请检查Firebase配置");
            setLoading(false);
            return;
          }
        } else {
          setUser(currentUser);
          setUserId(currentUser.uid);
          setCanEdit(!currentUser.isAnonymous);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase初始化失败:", error);
      setInitError("Firebase配置错误，请检查配置信息");
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">正在初始化...</div>;
  }

  if (initError) {
    return <div className="flex items-center justify-center h-screen text-red-500">{initError}</div>;
  }

  // 渲染不同模块
  const renderContent = () => {
    switch (activeTab) {
      case 'about':
        return <AboutModule canEdit={canEdit} db={db} userId={userId} />;
      case 'project':
        return <ProjectsModule canEdit={canEdit} db={db} userId={userId} />;
      case 'knowledge':
        return <KnowledgeModule canEdit={canEdit} db={db} userId={userId} />;
      case 'posts':
      default:
        return <PostsModule canEdit={canEdit} db={db} userId={userId} />;
    }
  };

  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-indigo-600 mr-8">我的个人空间</span>
              <div className="hidden md:flex space-x-4">
                {['posts', 'knowledge', 'about', 'project'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab === 'posts' && '我的思考'}
                    {tab === 'knowledge' && '知识库'}
                    {tab === 'about' && '个人介绍'}
                    {tab === 'project' && '项目'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">
                {canEdit ? '管理员在线' : `访客`}
              </span>
              {canEdit && (
                <button
                  onClick={() => auth.signOut()}
                  className="text-xs text-red-400 hover:text-red-600 ml-2 border p-1 rounded"
                >
                  退出
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Mobile tabs */}
        <div className="md:hidden flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          {['posts', 'knowledge', 'about', 'project'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === tab
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600'
              }`}
            >
              {tab === 'posts' && 'Posts'}
              {tab === 'knowledge' && 'Knowledge'}
              {tab === 'about' && 'About'}
              {tab === 'project' && 'Projects'}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {renderContent()}
      </main>

      <footer className="text-center text-gray-400 py-8 text-sm border-t mt-12">
        © {new Date().getFullYear()} 个人品牌网站.
      </footer>
    </div>
  );
}

// Posts 模块
function PostsModule({ canEdit, db, userId }) {
  const [posts, setPosts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', mediaUrl: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    const q = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('posts')
                .orderBy('createdAt', 'desc');
    const unsubscribe = q.onSnapshot(snapshot => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setPosts(list);
    }, (error) => {
      console.error("Posts fetch error:", error);
    });
    return () => unsubscribe();
  }, [db]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit || !form.title || !form.content) return;
    setLoading(true);
    try {
      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('posts').add({
        ...form,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        authorId: userId
      });
      setForm({ title: '', content: '', mediaUrl: '' });
      setIsEditing(false);
    } catch (err) {
      console.error("发布失败:", err);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('确定要删除这条内容吗？')) {
      try {
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('posts').doc(id).delete();
      } catch (error) {
        console.error("删除失败:", error);
      }
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '刚刚';
    return new Date(timestamp.toDate()).toLocaleString();
  };

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
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="ml-1">{isEditing ? '取消发布' : '写点什么'}</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 animate-fade-in">
          <h3 className="text-lg font-bold mb-4">发布新内容</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="标题：今天的灵感是什么？"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={form.title}
              onChange={(e) => setForm({...form, title: e.target.value})}
            />
            <textarea
              placeholder="内容：详细描述你的想法..."
              rows="4"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={form.content}
              onChange={(e) => setForm({...form, content: e.target.value})}
            />
            <div className="flex space-x-3">
              <input
                type="text"
                placeholder="媒体链接 (粘贴图片/视频的 URL)"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                value={form.mediaUrl}
                onChange={(e) => setForm({...form, mediaUrl: e.target.value})}
              />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-md">
              {loading ? '发布中...' : '发布'}
            </button>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="text-center text-gray-400 py-10">暂无内容，快来发布第一条想法吧！</div>
        ) : (
          posts.map(post => {
            const date = formatDate(post.createdAt);
            const mediaHtml = post.mediaUrl ? (
              <div className="mt-4 rounded-lg overflow-hidden bg-gray-100 max-h-96 flex justify-center border border-gray-200">
                {post.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                  <video src={post.mediaUrl} controls className="max-w-full max-h-full"></video>
                ) : (
                  <img
                    src={post.mediaUrl}
                    alt="Post media"
                    className="object-contain max-h-96 w-full"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://placehold.co/600x400/CCCCCC/333333?text=无法加载媒体';
                    }}
                  />
                )}
              </div>
            ) : null;

            return (
              <article key={post.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{post.title}</h3>
                  {canEdit && (
                    <button onClick={() => handleDelete(post.id)} className="text-gray-400 hover:text-red-500 p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                {mediaHtml}
                <div className="mt-4 text-xs text-gray-400">
                  发布于 {date}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

// Knowledge 模块
function KnowledgeModule({ canEdit, db, userId }) {
  const [links, setLinks] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '', category: '未分类' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    const q = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('knowledge')
                .orderBy('createdAt', 'desc');
    const unsubscribe = q.onSnapshot(snapshot => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setLinks(list);
    }, (error) => {
      console.error("Knowledge fetch error:", error);
    });
    return () => unsubscribe();
  }, [db]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!canEdit || !newLink.title || !newLink.url) return;
    setLoading(true);
    try {
      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('knowledge').add({
        ...newLink,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      setNewLink({ title: '', url: '', category: '未分类' });
      setIsEditing(false);
    } catch (error) {
      console.error("添加失败:", error);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if(window.confirm('删除此条目？')) {
      try {
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('knowledge').doc(id).delete();
      } catch(error) {
        console.error("删除失败:", error);
      }
    }
  };

  const categories = [...new Set(['未分类', ...links.map(item => item.category || '未分类')])];

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">个人知识库</h2>
          <p className="text-gray-500 mt-1">收藏有价值的链接、文章与资源</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="ml-1">添加资源</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 mb-8">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">标题</label>
              <input
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                placeholder="资源标题"
                value={newLink.title}
                onChange={(e) => setNewLink({...newLink, title: e.target.value})}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">外部链接/文件URL</label>
              <input
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                placeholder="URL 链接"
                value={newLink.url}
                onChange={(e) => setNewLink({...newLink, url: e.target.value})}
              />
            </div>
            <div className="md:col-span-1 flex space-x-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">分类</label>
                <input
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                  placeholder="分类 (如: AI工具)"
                  value={newLink.category}
                  onChange={(e) => setNewLink({...newLink, category: e.target.value})}
                />
              </div>
              <button type="submit" disabled={loading} className="px-4 py-2 h-10 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-md">
                保存
              </button>
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
              <h3 className="text-xl font-bold text-gray-700 mb-3 border-l-4 border-indigo-500 pl-3">{cat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {catLinks.map(link => (
                  <div key={link.id} className="group bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition flex justify-between items-center">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center flex-1 min-w-0">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full mr-3 group-hover:bg-indigo-600 group-hover:text-white transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <div className="truncate">
                        <div className="font-medium text-gray-800 truncate">{link.title}</div>
                        <div className="text-xs text-gray-400 truncate">{link.url}</div>
                      </div>
                    </a>
                    {canEdit && (
                      <button onClick={() => handleDelete(link.id)} className="ml-2 text-gray-300 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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

// About 模块
function AboutModule({ canEdit, db, userId }) {
  const [profile, setProfile] = useState({
    name: '职场探索者',
    title: '行业专家 / 终身学习者',
    bio: '在这里写下您的个人简介。例如：拥有10年+行业经验，专注于...',
    contacts: [
      { id: 1, type: 'Email', value: 'email@example.com' },
      { id: 2, type: 'GitHub', value: 'github.com/your-profile' },
    ],
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    const fetchProfile = async () => {
      try {
        const docRef = db.collection('artifacts').doc(appId).collection('public').doc('data').doc('profile').collection('main').doc('profile');
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data();
          if (!data.contacts || !Array.isArray(data.contacts)) {
            data.contacts = profile.contacts;
          }
          setProfile(data);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchProfile();
  }, [db]);

  const handleSave = async () => {
    if (!canEdit) return;
    setLoading(true);
    try {
      const docRef = db.collection('artifacts').doc(appId).collection('public').doc('data').doc('profile').collection('main').doc('profile');
      await docRef.set({
        ...profile,
        contacts: profile.contacts.filter(c => c.value && c.type)
      });
      setIsEditing(false);
    } catch(error) {
      console.error("保存失败:", error);
    }
    setLoading(false);
  };

  const handleContactChange = (id, field, value) => {
    setProfile(prev => ({
      ...prev,
      contacts: prev.contacts.map(contact =>
        contact.id === id ? { ...contact, [field]: value } : contact
      )
    }));
  };

  const handleAddContact = () => {
    setProfile(prev => ({
      ...prev,
      contacts: [...prev.contacts, { id: Date.now(), type: '', value: '' }]
    }));
  };

  const handleRemoveContact = (id) => {
    setProfile(prev => ({
      ...prev,
      contacts: prev.contacts.filter(contact => contact.id !== id)
    }));
  };

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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}

        {isEditing ? (
          <div className="space-y-4 text-left mt-4">
            <label className="block text-sm font-medium text-gray-700">姓名</label>
            <input
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500"
              value={profile.name}
              onChange={(e) => setProfile({...profile, name: e.target.value})}
            />

            <label className="block text-sm font-medium text-gray-700">头衔/标签</label>
            <input
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500"
              value={profile.title}
              onChange={(e) => setProfile({...profile, title: e.target.value})}
            />

            <label className="block text-sm font-medium text-gray-700">简介</label>
            <textarea
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-indigo-500"
              rows="4"
              value={profile.bio}
              onChange={(e) => setProfile({...profile, bio: e.target.value})}
            ></textarea>

            <label className="block text-sm font-medium text-gray-700 mt-4">联系方式 ({profile.contacts.length})</label>
            <div className="space-y-2 border p-3 rounded-lg bg-gray-50">
              {profile.contacts.map(contact => (
                <div key={contact.id} className="flex space-x-2">
                  <input
                    className="w-1/3 border border-gray-300 p-2 rounded"
                    placeholder="类型 (Email, Github...)"
                    value={contact.type}
                    onChange={(e) => handleContactChange(contact.id, 'type', e.target.value)}
                  />
                  <input
                    className="flex-1 border border-gray-300 p-2 rounded"
                    placeholder="值"
                    value={contact.value}
                    onChange={(e) => handleContactChange(contact.id, 'value', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveContact(contact.id)}
                    className="p-2 text-red-400 hover:text-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddContact}
                className="w-full text-indigo-600 border border-indigo-200 py-1 rounded hover:bg-indigo-50 text-sm flex items-center justify-center mt-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className="ml-1">添加新联系方式</span>
              </button>
            </div>

            <button onClick={handleSave} disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 shadow-md">
              {loading ? '保存中...' : '保存资料'}
            </button>
            <button onClick={() => setIsEditing(false)} className="w-full mt-2 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400">
              取消
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900">{profile.name}</h1>
            <p className="text-indigo-600 font-medium mt-1">{profile.title}</p>
            <div className="mt-6 text-gray-600 leading-relaxed whitespace-pre-wrap text-left bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-inner">
              {profile.bio}
            </div>
            <div className="mt-8 pt-6 border-t flex flex-wrap justify-center gap-4 text-gray-500">
              {profile.contacts.map(contact => (
                <div key={contact.id} className="flex items-center bg-gray-100 px-3 py-1 rounded-full text-sm">
                  <span className="font-semibold text-gray-700 mr-2">{contact.type}:</span>
                  <a href={contact.type.toLowerCase() === 'email' ? 'mailto:' + contact.value : contact.value} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 truncate max-w-xs">
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

// Projects 模块
function ProjectsModule({ canEdit, db, userId }) {
  const [projects, setProjects] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', link: '', status: '进行中' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    const q = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects')
                .orderBy('createdAt', 'desc');
    const unsubscribe = q.onSnapshot(snapshot => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setProjects(list);
    }, (error) => {
      console.error("Projects fetch error:", error);
    });
    return () => unsubscribe();
  }, [db]);

  const handleStartEdit = (project = null) => {
    if (project) {
      setCurrentProject(project);
      setForm({ title: project.title, description: project.description, link: project.link || '', status: project.status || '进行中' });
    } else {
      setCurrentProject(null);
      setForm({ title: '', description: '', link: '', status: '进行中' });
    }
    setIsEditing(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit || !form.title || !form.description) return;
    setLoading(true);
    try {
      if (currentProject) {
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects').doc(currentProject.id).update({
          ...form,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects').add({
          ...form,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          authorId: userId
        });
      }
      setIsEditing(false);
      setCurrentProject(null);
      setForm({ title: '', description: '', link: '', status: '进行中' });
    } catch (err) {
      console.error("操作失败:", err);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('确定要删除这个项目吗？')) {
      try {
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('projects').doc(id).delete();
      } catch (error) {
        console.error("删除失败:", error);
      }
    }
  };

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
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="ml-1">创建新项目</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 animate-fade-in">
          <h3 className="text-lg font-bold mb-4">{currentProject ? '编辑项目' : '创建新项目'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="项目名称"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={form.title}
              onChange={(e) => setForm({...form, title: e.target.value})}
            />
            <textarea
              placeholder="项目描述：目标、技术栈、成果等..."
              rows="3"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={form.description}
              onChange={(e) => setForm({...form, description: e.target.value})}
            ></textarea>
            <div className="flex space-x-4">
              <input
                type="url"
                placeholder="项目链接 (Github/Demo URL)"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                value={form.link}
                onChange={(e) => setForm({...form, link: e.target.value})}
              />
              <select
                className="w-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={form.status}
                onChange={(e) => setForm({...form, status: e.target.value})}
              >
                <option value="进行中">进行中</option>
                <option value="已完成">已完成</option>
                <option value="搁置">搁置</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => { setIsEditing(false); setCurrentProject(null); setForm({ title: '', description: '', link: '', status: '进行中' }); }} className="py-2 px-4 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                取消
              </button>
              <button type="submit" disabled={loading} className="py-2 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-md">
                {currentProject ? '保存修改' : '创建项目'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.length === 0 ? (
          <div className="md:col-span-2 text-center text-gray-400 py-10">暂无项目，快来展示您的作品吧！</div>
        ) : (
          projects.map(project => (
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="ml-1">查看项目</span>
                  </a>
                ) : (
                  <span className="text-sm text-gray-400 flex items-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="ml-1">无外部链接</span>
                  </span>
                )}
                {canEdit && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleStartEdit({ id: project.id, title: project.title, description: project.description, link: project.link || '', status: project.status || '进行中' })}
                      className="text-gray-400 hover:text-indigo-500 p-1"
                      title="编辑"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="删除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
