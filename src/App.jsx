import { useState, useEffect } from 'react'

function App() {
  const [inputText, setInputText] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [savedRecords, setSavedRecords] = useState([])
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState('input')
  const [valueRating, setValueRating] = useState(9.2)
  const [selectedTag, setSelectedTag] = useState('全部')
  const [allTags, setAllTags] = useState(['全部'])
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [frequentTags, setFrequentTags] = useState([])
  const [inputMode, setInputMode] = useState('text') // 'text' or 'url' or 'image'
  const [isExtracting, setIsExtracting] = useState(false)
  const [selectedTags, setSelectedTags] = useState([])
  const [tagLibrary, setTagLibrary] = useState({})
  const [allTagsFromRecords, setAllTagsFromRecords] = useState(['全部'])
  const [showTagLibrary, setShowTagLibrary] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  // 注意：智谱AI和Notion客户端需要在后端环境中初始化
  // 在浏览器环境中直接使用会导致错误，因为它们依赖Node.js模块
  // 建议创建一个后端API来处理AI分析和Notion存储
  // 以下是模拟实现，实际项目中请替换为后端API调用

  // 从本地存储加载保存的记录
  useEffect(() => {
    const records = localStorage.getItem('aiSummaryRecords')
    if (records) {
      setSavedRecords(JSON.parse(records))
    }
  }, [])

  // 加载标签库
  useEffect(() => {
    const loadTagLibrary = async () => {
      try {
        const response = await fetch('/api/tags')
        if (response.ok) {
          const data = await response.json()
          setTagLibrary(data.tags)
          setAllTagsFromRecords(data.allTags)
        }
      } catch (error) {
        console.error('加载标签库失败:', error)
      }
    }
    loadTagLibrary()
  }, [])

  // 收集所有记录的主题标签并计算频率
  useEffect(() => {
    if (savedRecords.length > 0) {
      // 收集所有记录的主题标签
      const tags = new Set(['全部'])
      const tagFrequency = {}
      savedRecords.forEach(record => {
        if (record.result && record.result.topicTags) {
          record.result.topicTags.forEach(tag => {
            tags.add(tag)
            tagFrequency[tag] = (tagFrequency[tag] || 0) + 1
          })
        }
      })
      setAllTagsFromRecords([...tags])
      
      // 计算常用标签（按频率排序，取前6个）
      const sortedTags = Object.entries(tagFrequency)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
      setFrequentTags(sortedTags)
    }
  }, [savedRecords])

  // 处理卡片点击
  const handleCardClick = (record) => {
    setSelectedRecord(record)
    setShowDetail(true)
  }

  // 处理返回按钮点击
  const handleBackToKnowledge = () => {
    setShowDetail(false)
    setSelectedRecord(null)
  }

  // 打开搜索界面
  const openSearch = () => {
    setIsSearchOpen(true)
  }

  // 关闭搜索界面
  const closeSearch = () => {
    setIsSearchOpen(false)
  }

  // 选择标签筛选
  const handleTagSelect = (tag) => {
    setSelectedTag(tag)
    setIsSearchOpen(false)
  }

  // 清除筛选
  const clearFilter = () => {
    setSelectedTag('全部')
    setIsSearchOpen(false)
  }

  // 保存记录到本地存储和Notion数据库
  const saveRecord = async () => {
    if (analysisResult) {
      setIsSaving(true)
      try {
        // 创建新记录
    const tagsToUse = selectedTags.length > 0 ? selectedTags : analysisResult.topicTags;
    const newRecord = {
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      input: inputText.substring(0, 100) + (inputText.length > 100 ? '...' : ''),
      fullInput: inputText,
      result: {
        ...analysisResult,
        topicTags: tagsToUse
      },
      value: valueRating
    }

        // 保存到Notion
        const response = await fetch('/api/save-to-notion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ record: newRecord })
        })
        
        const result = await response.json()
        if (result.success) {
          // 保存Notion页面ID到记录中
          newRecord.notionPageId = result.pageId
        }

        // 保存到本地存储
        const updatedRecords = [newRecord, ...savedRecords]
        setSavedRecords(updatedRecords)
        localStorage.setItem('aiSummaryRecords', JSON.stringify(updatedRecords))

        alert('记录已保存')
        // 保存后跳转到知识库页面
        setActiveTab('knowledge')
      } catch (error) {
        console.error('保存记录失败:', error)
        alert('保存到Notion失败，但已保存到本地存储')
        // 即使保存失败也跳转到知识库页面
        setActiveTab('knowledge')
      } finally {
        setIsSaving(false)
      }
    }
  }

  // 编辑记录
  const handleEditRecord = (record) => {
    // 这里可以实现编辑功能，例如打开编辑对话框
    // 为了简化，我们暂时将记录内容填充到输入框，方便用户修改
    setInputText(record.input.replace('...', ''))
    setAnalysisResult(record.result)
  }

  // 删除记录
  const handleDeleteRecord = async (recordId) => {
    if (window.confirm('确定要删除这条记录吗？')) {
      try {
        // 找到要删除的记录
        const recordToDelete = savedRecords.find(record => record.id === recordId)
        
        // 如果记录有Notion页面ID，则删除Notion中的记录
        if (recordToDelete && recordToDelete.notionPageId) {
          await fetch('/api/delete-from-notion', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId: recordToDelete.notionPageId })
          })
        }

        // 删除本地存储中的记录
        const updatedRecords = savedRecords.filter(record => record.id !== recordId)
        setSavedRecords(updatedRecords)
        localStorage.setItem('aiSummaryRecords', JSON.stringify(updatedRecords))

        alert('记录已删除')
      } catch (error) {
        console.error('删除记录失败:', error)
        alert('删除Notion记录失败，但已删除本地存储中的记录')
      }
    }
  }

  // 提取URL内容
  const extractUrlContent = async () => {
    if (!inputText.trim()) {
      alert('请输入URL')
      return
    }

    setIsExtracting(true)

    try {
      const response = await fetch('/api/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputText })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'URL提取失败')
      }
      
      const result = await response.json()
      // 将提取的内容设置到输入框中
      const fullContent = result.title ? `${result.title}\n\n${result.content}` : result.content
      setInputText(fullContent)
      setInputMode('text') // 切换回文本模式以便编辑
      alert('内容已提取成功！您可以编辑后再进行AI分析')
    } catch (error) {
      console.error('URL提取失败:', error)
      alert(error.message || 'URL内容提取失败，请稍后重试')
    } finally {
      setIsExtracting(false)
    }
  }

  // 处理图片上传
  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        alert('请上传图片文件')
        return
      }
      
      // 检查文件大小（限制为5MB）
      if (file.size > 5 * 1024 * 1024) {
        alert('图片大小不能超过5MB')
        return
      }
      
      setSelectedImage(file)
      
      // 生成预览
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // 处理粘贴图片
  const handlePaste = (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items
    for (let item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file.type.startsWith('image/')) {
          e.preventDefault()
          setSelectedImage(file)
          
          // 生成预览
          const reader = new FileReader()
          reader.onload = (e) => {
            setImagePreview(e.target.result)
          }
          reader.readAsDataURL(file)
          break
        }
      }
    }
  }

  // 提取图片内容
  const extractImageContent = async () => {
    if (!selectedImage) {
      alert('请选择图片')
      return
    }

    setIsExtracting(true)

    try {
      console.log('开始提取图片内容')
      console.log('图片文件:', selectedImage)
      console.log('图片类型:', selectedImage.type)
      console.log('图片大小:', selectedImage.size)
      
      const formData = new FormData()
      formData.append('image', selectedImage)
      
      console.log('FormData创建成功，准备发送请求')
      
      const response = await fetch('/api/extract-image', {
        method: 'POST',
        body: formData
      })
      
      console.log('Response received')
      console.log('Response status:', response.status)
      console.log('Response status text:', response.statusText)
      console.log('Response headers:', response.headers)
      
      const contentType = response.headers.get('content-type')
      console.log('Content-Type:', contentType)
      
      if (!response.ok) {
        console.log('Response not ok')
        try {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json()
            console.log('Error data:', errorData)
            throw new Error(errorData.error || '图片提取失败')
          } else {
            const errorText = await response.text()
            console.error('Error response text:', errorText)
            throw new Error('图片提取失败: ' + errorText.substring(0, 100))
          }
        } catch (e) {
          console.error('Error processing response:', e)
          throw e
        }
      }
      
      console.log('Response ok, parsing JSON')
      const result = await response.json()
      console.log('Result:', result)
      
      // 将提取的内容设置到输入框中
      setInputText(result.content)
      setInputMode('text') // 切换回文本模式以便编辑
      setSelectedImage(null)
      setImagePreview(null)
      alert('图片内容已提取成功！您可以编辑后再进行AI分析')
    } catch (error) {
      console.error('图片提取失败:', error)
      alert('图片内容提取失败，请稍后重试\n' + error.message)
    } finally {
      setIsExtracting(false)
    }
  }

  // 重置内容
  const resetContent = () => {
    if (window.confirm('确定要重置所有内容吗？')) {
      setInputText('')
      setNoteText('')
      setInputMode('text')
      setSelectedTags([])
      setAnalysisResult(null)
      setValueRating(9.2)
      setSelectedImage(null)
      setImagePreview(null)
    }
  }

  // 使用后端API进行AI分析
  const analyzeText = async () => {
    if (!inputText.trim()) {
      alert('请输入内容')
      return
    }

    setIsAnalyzing(true)

    try {
      // 调用后端API
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: inputText,
          note: noteText 
        })
      })
      
      if (!response.ok) {
        throw new Error('API调用失败')
      }
      
      const result = await response.json()
      setAnalysisResult(result)
      // 分析完成后停留在输入页面，显示分析结果
      // 不切换到知识库页面
    } catch (error) {
      console.error('AI分析失败:', error)
      alert('AI分析失败，请稍后重试')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className={`app ${isDarkMode ? 'dark-mode' : ''}`}>
      {/* 顶部导航 */}
      <div className="top-nav">
        <div className="app-title">干炒牛河的MindWeave</div>
        <div className="nav-actions">
          <button className="nav-action-button">
            <span className="bell-icon">🔔</span>
          </button>
        </div>
      </div>

      {/* 主内容区域 */}
      {activeTab === 'input' && !isAnalyzing && !analysisResult && (
        <div className="input-section">
          <h2>今天刷到了什么？</h2>
          <p className="input-subtitle">粘贴任何内容，AI 帮你加成知识卡片</p>
          
          {/* 输入模式切换 */}
          <div className="input-mode-toggle">
            <button 
              className={`mode-button ${inputMode === 'text' ? 'active' : ''}`}
              onClick={() => setInputMode('text')}
            >
              📝 文本
            </button>
            <button 
              className={`mode-button ${inputMode === 'url' ? 'active' : ''}`}
              onClick={() => setInputMode('url')}
            >
              🔗 链接
            </button>
            <button 
              className={`mode-button ${inputMode === 'image' ? 'active' : ''}`}
              onClick={() => setInputMode('image')}
            >
              🖼️ 图片
            </button>
          </div>
          
          {inputMode === 'image' ? (
            <div className="image-upload-section" onPaste={handlePaste}>
              <div className="image-upload-area">
                {imagePreview ? (
                  <div className="image-preview-container">
                    <img src={imagePreview} alt="预览" className="image-preview" />
                    <button 
                      className="remove-image-button"
                      onClick={() => {
                        setSelectedImage(null)
                        setImagePreview(null)
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      className="image-input"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="upload-label">
                      <span className="upload-icon">📷</span>
                      <p>点击上传图片</p>
                      <p className="upload-hint">或直接粘贴图片</p>
                      <p className="upload-info">支持 JPG、PNG、WebP 格式，最大 5MB</p>
                    </label>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={inputMode === 'url' ? '粘贴文章链接，如微信文章、网页链接等...' : '粘贴短视频文案、笔记或想法...'}
              className="input-textarea"
              rows={inputMode === 'url' ? 3 : 10}
            />
          )}
          
          {/* 笔记区域 */}
          <div className="note-section">
            <div className="note-header">
              <span className="note-icon">📝</span>
              <span className="note-label">我的笔记（可选）</span>
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="记录你的即时想法、感受或问题...这些内容会帮助AI更准确地分析..."
              className="note-textarea"
              rows={3}
            />
          </div>
          
          <div className="input-tags">
            <span className="tag">支持：</span>
            {inputMode === 'text' ? (
              <>
                <span className="tag">短视频文案</span>
                <span className="tag">随想笔记</span>
                <span className="tag">任何文本</span>
              </>
            ) : inputMode === 'url' ? (
              <>
                <span className="tag">微信文章</span>
                <span className="tag">网页链接</span>
                <span className="tag">公众号文章</span>
              </>
            ) : (
              <>
                <span className="tag">照片</span>
                <span className="tag">截图</span>
                <span className="tag">图片文档</span>
              </>
            )}
          </div>
          
          {/* 价值评分拖动条 */}
          <div className="value-slider">
            <label htmlFor="value-rating">价值评分：{valueRating.toFixed(1)}</label>
            <input
              type="range"
              id="value-rating"
              min="0"
              max="10"
              step="0.1"
              value={valueRating}
              onChange={(e) => setValueRating(parseFloat(e.target.value))}
              className="slider"
            />
          </div>
          
          <div className="button-group">
            {inputMode === 'url' ? (
              <button 
                className="primary-button" 
                onClick={extractUrlContent} 
                disabled={isExtracting}
              >
                {isExtracting ? '提取中...' : '提取链接内容'}
              </button>
            ) : inputMode === 'image' ? (
              <button 
                className="primary-button" 
                onClick={extractImageContent} 
                disabled={isExtracting}
              >
                {isExtracting ? '提取中...' : '提取图片内容'}
              </button>
            ) : (
              <button 
                className="primary-button" 
                onClick={analyzeText} 
                disabled={isAnalyzing}
              >
                {isAnalyzing ? '分析中...' : 'AI 生成知识卡片'}
              </button>
            )}
            <button 
              className="reset-button" 
              onClick={resetContent}
            >
              重置内容
            </button>
          </div>
          

        </div>
      )}

      {/* 加载状态 */}
      {isAnalyzing && (
        <div className="loading-section">
          <div className="loading-header">
            <button className="back-button" onClick={() => setIsAnalyzing(false)}>
              &lt; 返回
            </button>
            <h2>AI 分析中</h2>
          </div>
          <div className="loading-content">
            <div className="loading-spinner">
              <div className="spinner-circle"></div>
            </div>
            <p>AI 正在思考中...</p>
            <p>正在提炼核心观点和行动建议</p>
            
            <div className="loading-progress">
              <div className="progress-item">
                <div className="progress-check">✓</div>
                <div className="progress-text">读取内容</div>
              </div>
              <div className="progress-item">
                <div className="progress-check">✓</div>
                <div className="progress-text">提炼核心观点</div>
              </div>
              <div className="progress-item">
                <div className="progress-check">⟳</div>
                <div className="progress-text">正在分析深层含义...</div>
              </div>
              <div className="progress-item">
                <div className="progress-check">○</div>
                <div className="progress-text">生成行动建议</div>
              </div>
            </div>
            
            <button className="cancel-button" onClick={() => setIsAnalyzing(false)}>
              取消生成
            </button>
          </div>
        </div>
      )}

      {/* 知识卡片内容 - 在AI思考结束后出现 */}
      {!isAnalyzing && analysisResult && activeTab === 'input' && (
        <div className="output-section">
          <div className="result-header">
            <button className="back-button" onClick={() => setAnalysisResult(null)}>
              &lt; 返回
            </button>
            <h2>知识卡片</h2>
            <div className="result-actions">
              <button className="action-button">🔗</button>
              <button className="action-button">...</button>
            </div>
          </div>
          
          {/* 标题 */}
          <div className="summary-card">
            <div className="summary-content">
              {analysisResult.title || analysisResult.summary || '暂无标题'}
            </div>
            {/* 主题标签 */}
            <div className="tags-container">
              {analysisResult.topicTags && analysisResult.topicTags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </div>
          
          {/* 标签编辑和推荐 */}
          <div className="tag-editor">
            <div className="tag-editor-header">
              <h3>推荐标签</h3>
              <button 
                className="view-all-tags-button"
                onClick={() => setShowTagLibrary(true)}
              >
                查看全部标签
              </button>
            </div>
            <div className="recommended-tags">
              {analysisResult.recommendedTags && analysisResult.recommendedTags.length > 0 ? (
                analysisResult.recommendedTags.map((tag, index) => (
                  <button
                    key={index}
                    className={`recommended-tag ${selectedTags.includes(tag) ? 'selected' : ''}`}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                  >
                    {tag}
                  </button>
                ))
              ) : (
                <p className="no-recommendations">暂无推荐标签</p>
              )}
            </div>
            {selectedTags.length > 0 && (
              <div className="selected-tags">
                <h4>已选标签</h4>
                <div className="tags-container">
                  {selectedTags.map((tag, index) => (
                    <span key={index} className="tag selected">
                      {tag}
                      <button 
                        className="tag-remove"
                        onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* 标签库模态框 */}
          {showTagLibrary && (
            <div className="tag-library-overlay" onClick={() => setShowTagLibrary(false)}>
              <div className="tag-library-content" onClick={(e) => e.stopPropagation()}>
                <div className="tag-library-header">
                  <h2>标签库</h2>
                  <button className="close-button" onClick={() => setShowTagLibrary(false)}>×</button>
                </div>
                <div className="tag-library-body">
                  {Object.entries(tagLibrary).map(([category, tags]) => (
                    <div key={category} className="tag-category">
                      <h3 className="category-title">{category}</h3>
                      <div className="category-tags">
                        {tags.map((tag, index) => (
                          <button
                            key={index}
                            className={`library-tag ${selectedTags.includes(tag) ? 'selected' : ''}`}
                            onClick={() => {
                              if (selectedTags.includes(tag)) {
                                setSelectedTags(selectedTags.filter(t => t !== tag));
                              } else {
                                setSelectedTags([...selectedTags, tag]);
                              }
                            }}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="tag-library-footer">
                  <button className="confirm-button" onClick={() => setShowTagLibrary(false)}>
                    确定
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className="result-card">
            <div className="result-item">
              <h3>核心认知</h3>
              <ul>
                <li>{analysisResult.summary || '暂无核心认知'}</li>
              </ul>
            </div>
            <div className="result-item">
              <h3>本质解释</h3>
              <ul>
                {analysisResult.coreInsights ? (
                  <li>{analysisResult.coreInsights}</li>
                ) : (
                  analysisResult.importance && analysisResult.importance.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))
                )}
              </ul>
            </div>
            <div className="result-item">
              <h3>适用场景</h3>
              <ul>
                {analysisResult.applicableScenarios ? (
                  <li>{analysisResult.applicableScenarios}</li>
                ) : (
                  analysisResult.actionSuggestions && analysisResult.actionSuggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))
                )}
              </ul>
            </div>
            <div className="result-item">
              <h3>关键信息</h3>
              <ul>
                {analysisResult.keyInformation && analysisResult.keyInformation.length > 0 ? (
                  analysisResult.keyInformation.map((info, index) => (
                    <li key={index}>{info}</li>
                  ))
                ) : (
                  <li>暂无关键信息</li>
                )}
              </ul>
            </div>
          </div>
          
          {/* 价值评分 */}
          <div className="value-rating">
            <div className="rating-item">
              <div className="rating-label">{valueRating.toFixed(1)}</div>
              <div className="rating-desc">价值</div>
            </div>
          </div>
          
          {isSaving ? (
            <div className="saving-progress">
              <div className="saving-progress-bar">
                <div className="saving-progress-fill"></div>
              </div>
              <p className="saving-text">正在保存到Notion...</p>
            </div>
          ) : (
            <button onClick={saveRecord} className="save-button">保存记录</button>
          )}
        </div>
      )}

      {/* 知识库页面 - 只展示保存记录的知识卡片 */}
      {activeTab === 'knowledge' && !showDetail && (
        <div className={`knowledge-base-section ${isSearchOpen ? 'search-active' : ''}`}>
          <div className="knowledge-header">
            <h2>知识库</h2>
            <div className="knowledge-stats">
              <button className="search-button" onClick={openSearch}>🔍</button>
            </div>
          </div>
          
          {/* 筛选结果指示器 */}
          {selectedTag !== '全部' && (
            <div className="filter-indicator">
              <span>当前筛选：{selectedTag}</span>
              <button className="clear-filter-button" onClick={() => setSelectedTag('全部')}>× 清除</button>
            </div>
          )}
          
          {/* 知识卡片列表 */}
          <div className="knowledge-cards">
            {savedRecords.length === 0 ? (
              <p className="no-records">暂无保存的记录</p>
            ) : (
              savedRecords
                .filter(record => {
                  if (selectedTag === '全部') return true;
                  return record.result && record.result.topicTags && record.result.topicTags.includes(selectedTag);
                })
                .map((record) => (
                  <div 
                    key={record.id} 
                    className="knowledge-card"
                    onClick={() => handleCardClick(record)}
                  >
                    <div className="card-header">
                      {/* 右上角时间 */}
                      <span className="card-time">{record.timestamp}</span>
                    </div>
                    <div className="card-content">
                      {/* 内容标题 */}
                      <h3 className="card-title">{record.result.title || record.result.summary || (record.result.corePoints && record.result.corePoints.length > 0 ? record.result.corePoints[0] : '暂无标题')}</h3>
                      {/* 主题标签 */}
                      <div className="card-tags">
                        {record.result.topicTags && record.result.topicTags.map((tag, index) => (
                          <span key={index} className="tag">{tag}</span>
                        ))}
                      </div>
                      {/* 核心认知 */}
                      <div className="card-summary">
                        <span className="summary-icon">💡</span>
                        <span className="summary-text">{record.result.summary || (record.result.corePoints && record.result.corePoints.length > 0 ? record.result.corePoints[0] : '暂无核心认知')}</span>
                      </div>
                    </div>
                    <div className="card-footer">
                      {/* 价值评分 */}
                      <div className="card-rating">
                        <span className="rating-star">⭐</span>
                        <span className="rating-value">{record.value || 9.2} 价值</span>
                      </div>
                      {/* 删除按钮 */}
                      <div className="card-actions">
                        <button 
                          className="card-action-button delete-button"
                          onClick={(e) => {
                            e.stopPropagation(); // 防止触发卡片点击事件
                            handleDeleteRecord(record.id);
                          }}
                          title="删除记录"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* 详细卡片界面 */}
      {activeTab === 'knowledge' && showDetail && selectedRecord && (
        <div className="detail-card-section">
          <div className="detail-header">
            <button className="back-button" onClick={handleBackToKnowledge}>
              &lt; 返回
            </button>
            <h2>知识卡片</h2>
            <div className="result-actions">
              <button className="action-button">🔗</button>
              <button className="action-button">...</button>
            </div>
          </div>
          
          {/* 标题 */}
          <div className="summary-card">
            <div className="summary-content">
              {selectedRecord.result.title || selectedRecord.result.summary || (selectedRecord.result.corePoints && selectedRecord.result.corePoints.length > 0 ? selectedRecord.result.corePoints[0] : '暂无标题')}
            </div>
            {/* 主题标签 */}
            <div className="tags-container">
              {selectedRecord.result.topicTags && selectedRecord.result.topicTags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </div>
          
          <div className="result-card">
            <div className="result-item">
              <h3>核心认知</h3>
              <ul>
                <li>{selectedRecord.result.summary || (selectedRecord.result.corePoints && selectedRecord.result.corePoints.length > 0 ? selectedRecord.result.corePoints[0] : '暂无核心认知')}</li>
              </ul>
            </div>
            <div className="result-item">
              <h3>本质解释</h3>
              <ul>
                {selectedRecord.result.coreInsights ? (
                  <li>{selectedRecord.result.coreInsights}</li>
                ) : (
                  selectedRecord.result.importance && selectedRecord.result.importance.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))
                )}
              </ul>
            </div>
            <div className="result-item">
              <h3>适用场景</h3>
              <ul>
                {selectedRecord.result.applicableScenarios ? (
                  <li>{selectedRecord.result.applicableScenarios}</li>
                ) : (
                  selectedRecord.result.actionSuggestions && selectedRecord.result.actionSuggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))
                )}
              </ul>
            </div>
            <div className="result-item">
              <h3>关键信息</h3>
              <ul>
                {selectedRecord.result.keyInformation && selectedRecord.result.keyInformation.length > 0 ? (
                  selectedRecord.result.keyInformation.map((info, index) => (
                    <li key={index}>{info}</li>
                  ))
                ) : (
                  <li>暂无关键信息</li>
                )}
              </ul>
            </div>
          </div>
          
          {/* 价值评分 */}
          <div className="value-rating">
            <div className="rating-item">
              <div className="rating-label">{selectedRecord.value.toFixed(1)}</div>
              <div className="rating-desc">价值</div>
            </div>
          </div>
          
          {/* 原文内容 */}
          <div className="original-content">
            <h3>原文内容</h3>
            <div className="original-text">
              {selectedRecord.fullInput || '暂无原文内容'}
            </div>
          </div>
        </div>
      )}

      {/* 搜索界面覆盖层 */}
      {isSearchOpen && (
        <div className={`search-overlay ${isSearchOpen ? 'open' : ''}`} onClick={closeSearch}>
          <div className="search-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeSearch}>×</button>
            <h2 className="search-title">标签筛选</h2>
            
            {/* 常用标签区域 */}
            {frequentTags.length > 0 && (
              <div className="tag-section">
                <h3 className="tag-section-title">常用标签</h3>
                <div className="tag-buttons">
                  {frequentTags.map((tag) => (
                    <button 
                      key={tag.name}
                      className={`tag-button ${selectedTag === tag.name ? 'active' : ''}`}
                      onClick={() => handleTagSelect(tag.name)}
                    >
                      {tag.name}
                      <span className="tag-count">{tag.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* 全部标签区域 */}
            <div className="tag-section">
              <h3 className="tag-section-title">全部标签</h3>
              <div className="tag-buttons">
                {allTagsFromRecords.filter(t => t !== '全部').map((tag) => (
                  <button 
                    key={tag}
                    className={`tag-button ${selectedTag === tag ? 'active' : ''}`}
                    onClick={() => handleTagSelect(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 清除筛选按钮 */}
            {selectedTag !== '全部' && (
              <button className="clear-all-button" onClick={clearFilter}>
                清除筛选 ({selectedTag})
              </button>
            )}
          </div>
        </div>
      )}

      {/* 底部导航栏 */}
      <div className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => {
            setAnalysisResult(null);
            setActiveTab('input');
          }}
        >
          <span className="nav-icon">📥</span>
          <span className="nav-label">输入</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'knowledge' ? 'active' : ''}`}
          onClick={() => setActiveTab('knowledge')}
        >
          <span className="nav-icon">📚</span>
          <span className="nav-label">知识库</span>
        </button>
      </div>
    </div>
  )
}

export default App