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

  // 初始化 Firebase
  useEffect(() => {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        await auth.signInAnonymously();
      } else {
        setUser(currentUser);
        setUserId(currentUser.uid);
        setCanEdit(!currentUser.isAnonymous);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">正在初始化...</div>;
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
