define(function(require, exports) {
	var lastImageList = {};
	var getImageArr = function(filePath,name){
		var imageList = kodApp.imageList;
		lastImageList = imageList || {};
		kodApp.imageList = false;
		var items  = [];
		if(!imageList) {
			imageList = {};
			items.push({
				src:core.pathImage(filePath,1200),srcFile:core.pathImage(filePath,false),
				msrc:core.pathImage(filePath,250),
				$dom:false,w:0,h:0,
				trueImage:core.pathImage(filePath,false),
				title:htmlEncode(name || ''),
			});
			imageList.index = 0;
		}
		_.each(imageList.items,function(item){
			var parse = $.parseUrl(item.src);
			var title = item.title || _.get(parse,'params.name') || pathTools.pathThis(item.src);
			items.push({
				src:item.src,srcFile:item.srcFile || '',
				$dom:item.$dom || false,
				msrc:item.msrc || item.src,
				trueImage:item.trueImage || '',
				title:htmlEncode(title),
				w:item.width  || 0,h:item.height  || 0,
				data:item,
			});
		});
		
		// 默认原图打开处理;
		_.each(items,function(item){
			if(openImageType != 'full' || !item.trueImage){return;}
			item._src = item.src;
			item.src = item.trueImage;
			item.trueImage = ''
		});
		return {items:items,index:imageList.index};
	};
	
	var gallery  = false;
	var initView = function(path,ext,name,photoSwipeTpl){
		var imageList = getImageArr(path,name);
		if($('.pswp_content').length == 0){
			$(photoSwipeTpl).appendTo('body');
			$('.pswp__caption__center').css({"text-align":"center"});
		}
		if($('.pswp').hasClass('pswp--open')) return;
		var options = {
			focus: true,
			index: 0,
			bgOpacity:0.8,
			maxSpreadZoom:5,
			closeOnScroll:false,
			shareEl: false,
			showHideOpacity:false,
			showAnimationDuration: 300,
			hideAnimationDuration: 500,
			fullscreenEl : true,
			history:false,
			preload:[1,5],
			isClickableElement:function(e){
				return true;
			},
			getThumbBoundsFn: function(index) {
				var item = imageList.items[index];
				if(!item || !item.$dom || item.$dom.length == 0){//目录切换后没有原图
					return {x:$(window).width()/2,y:$(window).height()/2,w:1,h:1};
				}
				var pageYScroll = window.pageYOffset || document.documentElement.scrollTop; 
				var rect = $(item.$dom).get(0).getBoundingClientRect();
				rect = {width:rect.width,height:rect.height,left:rect.left,top:rect.top};
				
				// 图片没有完全显示时(相册模式,高宽固定,定宽定高,超出从中间截取)
				if(rect.width == rect.height){
					var width  = parseInt(item.$dom.attr('img-width')  || item.$dom.width());
					var height = parseInt(item.$dom.attr('img-height') || item.$dom.height());
					var boxSize = rect.width;
					if(height > width){
						rect.height = (rect.width * height) / width; //重新计算高度; 保持比例不变;
						rect.top  = rect.top - (rect.height - boxSize) / 2; //图片取中间后上面偏移;
					}else{
						rect.width = (rect.height * width) / height; //重新计算高度; 保持比例不变;
						rect.left  = rect.left - (rect.width - boxSize) / 2; //图片取中间后左侧偏移;
					}
				}
				// console.log(102,__json(rect),index,item);
				return {
					x:rect.left || 0,
					y:rect.top + pageYScroll,
					w:rect.width,
					h:rect.height
				};
			}
		};
		
		if($.isWindowSmall()){
			options.history = true;
		}
		options.index = imageList.index;
		gallery = new PhotoSwipe($('.pswp').get(0),PhotoSwipeUI_Default,imageList.items,options);
		gallery.loadFinished = false;
		gallery.listen('gettingData', function(index, item) {
			if (item.w < 1 || item.h < 1) {
				var img = new Image(); 
				img.onload = function() {
					item.w = this.width;
					item.h = this.height;
					try {
						gallery.updateSize(true);
						if(gallery.currItem == item){
							$(gallery.currItem.container).parents('.pswp__item').removeClass('loading');
						}
					}catch(err){}
				}
				img.src = item.src;
			}

			//打开图片，加载动画起始位置
			if(!gallery.loadFinished){
				var rect = options.getThumbBoundsFn(index);
				item.w = rect.w;
				item.h = rect.h;
				
				if($(item.$dom).is('svg')){
					var svg = _.get($(item.$dom).get(0),'viewBox.baseVal') ;
					item.w  = svg.width  || item.w;
					item.h  = svg.height || item.h;
				}
				gallery.loadFinished = true;
			}
		});
		var imageCount = imageList.items.length;
		gallery.listen('close', function(){
			if(imageCount>=3){$('.pswp__item').not('.current').find('img').remove();}
			setTimeout(function(){
				$(gallery.container).find('.pswp__zoom-wrap').fadeOut(200);
			},300);
		});
		
		$('.pswp__container').addClass('init-first');
		setTimeout(function(){
			$('.pswp__container').removeClass('init-first');
			if(imageList.items.length == 1){ // 单张图片, ios浏览器异常情况处理;
				var htmlCurrent = $('.pswp .pswp__item.current .pswp__zoom-wrap').html();
				$(gallery.currItem.container).html(htmlCurrent);
			}
		},800);
		
		gallery.init();
		gallery.listen('bindEvents',imageRotateAuto);
		gallery.listen('imageErrorBefore',function(item){ //图片加载失败时,尝试加载原图;只处理一次;
			if(!item.srcFile || item._loadErrorCount){return;}

			item.img.src  = item.srcFile;
			item.src = item.srcFile;
			item._loadErrorCount = 1;
			$(item.img).bind('load',function(e){
				item.trueImage = false;
				gallery.shout('afterErrorReload');
			});
		});
		
		// 超过3张图片, 打开最后一张时缩放位置异常处理; 重置位置及大小;
		if(imageCount >= 3 && imageCount == imageList.index + 1){
			setTimeout(function(){
				gallery.next();gallery.prev();return;// 会有一次闪烁;

				gallery.currItem.container = $('.pswp__img--placeholder').parent().get(0);
				setTimeout(function(){ // setcontent, 每次都会从新生成currItem.container情况;
					gallery.currItem.container = $('.pswp__img--placeholder').parent().get(0);
				},100);
				gallery.updateSize(); // 关闭时,没有动画切换回到原图
			},350);
		}
		
		// 两张图片时,打开最后一个加载完成异常情况处理;
		if(imageCount == 2 && imageList.index == 1){
			setTimeout(function(){
				var $img = $('.pswp__container .pswp__item:eq(2) .pswp__img:not(.pswp__img--placeholder)');
				if($img.length){$img.appendTo('.pswp__container .pswp__item:eq(0) .pswp__zoom-wrap');}
			},500);
		}
		
		// 删除;
		gallery.removeCurrent = function(){
			if(!gallery.items || gallery.items.length <= 1){
				return gallery.close();
			}
			var resetHolder = function(){
				var index = gallery.getCurrentIndex();
				for (var i = 0; i < gallery.itemHolders.length; i++) {
					var holder = gallery.itemHolders[i];
					gallery.setContent(holder,index-1+i);
				}
			}
			var index = gallery.getCurrentIndex();
			if(gallery.items.length == 2 && index == 0){
				gallery.next();
				gallery.items.splice(index,1);
				resetHolder();gallery.prev();
				return;
			}
			gallery.items.splice(index,1);resetHolder();
			gallery.prev();gallery.goTo(index);
		};
		
		gallery.removeImage = function(){
			if(!lastImageList.removeCallback) return;
			lastImageList.removeCallback(gallery.currItem.data,function(){
				gallery.removeCurrent();
			});
		}
		setTimeout(function(){
			var $btnRemove = $('.pswp__button--remove').addClass('hidden');
			if(lastImageList.removeCallback){$btnRemove.removeClass('hidden');}
			
			var $btnInfo = $('.pswp__button--info').addClass('hidden');
			if(lastImageList.imageInfoCallback){$btnInfo.removeClass('hidden');}
		},10);
		window.photoSwipeView = gallery;
		gallery.lastImageList = lastImageList;
		
		// 解决滚动穿透问题;(UC,内嵌网页等情况)
		$(".pswp__bg").scrollTop($(".pswp__bg").scrollInnerHeight() / 2);
	};
	
	
	var bindCloseTag = false;
	var bindClose = function(){
		if(bindCloseTag) return;
		bindCloseTag = true;
		$(document).delegate('.pswp__item','touchend',function(e){
			setTimeout(function(){
				$(".pswp__bg").scrollTop($(".pswp__bg").scrollInnerHeight() / 2);
			},10);
		});
		$(document).delegate('.pswp__item','click',function(e){
			if(!$(e.target).existParent('.pswp__zoom-wrap')){
				// 移动端点击非图片区域关闭;  小图片滑动不在图片上异常关闭问题;
				$(".pswp__button--close").trigger("click");
			}
		});
	}
	
	var optionsList = function(storeKey,lengthMax){
		LocalData.values = LocalData.values || {};
		var values = LocalData.values[storeKey] || LocalData.getConfig(storeKey) || {};
		LocalData.values[storeKey] = values;
		var get = function(key,defaultValue){
			return values[key] || defaultValue;
		}
		var set = function(key,value){
			values[key] = value;
			if(value == null){delete values[key];}
			save();
		}
		var save = function(){
			if(!lengthMax) return;
			var keys = Object.keys(values);
			if(keys.length > lengthMax){
				var newValues = {};
				keys = keys.slice(keys.length - lengthMax);
				for(var i = 0; i < keys.length; i++) {
					newValues[keys[i]] = values[keys[i]];
				}
				values = newValues;
			}
			LocalData.setConfig(storeKey,values);
		};
		var clear = function(){values = {};save();}
		return {set:set,get:get,clear:clear};
	}
	
	// 图片旋转
	var imageRotateAuto = function(){
		_.each(gallery.itemHolders,function(holder){
			if(!holder || !holder.item) return;
			var radius = imageRotateList.get(holder.item.src,0);
			imageRotateItem(holder.item,radius);
		});
		imageHolderShow();
	}
	
	// 显示占位图处理优化;
	var imageHolderShow = function(){
		var current = gallery.currItem;
		var $dom = $(current.container);
		var $loading = $dom.find('.pswp__img--placeholder');
		$('.pswp__item').removeClass('current').removeClass('loading');
		$dom.parents('.pswp__item').addClass('current').addClass('loading');
		if(!$loading.length){
			var $imageNow = $dom.find('.pswp__img');
			$loading = $("<img class='pswp__img pswp__img--placeholder add' src='"+htmlEncode(current.msrc)+"'>").prependTo($dom);
			$loading.css({width:$imageNow.width(),height:$imageNow.height()});
		}
		if(current.loaded){
			$dom.parents('.pswp__item').removeClass('loading');
		}
		if($dom && $dom.attr('style')){
			var style = $dom.attr('style').replace(/scale\((\d+)\)/,'scale(1)');
			$dom.attr('style',style);
		}
		photoSwipeView.updateSize(true);
	}
	
	var imageRotateList = new optionsList('imageRotate',500);
	var bindRotate = function(){
		gallery.listen('afterChange',imageRotateAuto);
		if($('.pswp__button--rotate').length) return;
		var html = '<button class="pswp__button pswp__button--rotate"></button>';
		var $button = $(html).insertAfter('.pswp__button--close');
		$button.unbind('click').bind('click', function(e){
			var radius = parseInt(imageRotateItem(gallery.currItem,'get')) + 90;
			imageRotateItem(gallery.currItem,radius,true);
			$('.pswp__ui--hidden').removeClass('pswp__ui--hidden');
		});
	};
	var bindRemove = function(){
		gallery.listen('afterChange',imageRotateAuto);
		if($('.pswp__button--remove').length) return;
		var html = '<button class="pswp__button pswp__button--remove"></button>';
		var $button = $(html).insertAfter('.pswp__button--close');
		$button.unbind('click').bind('click', function(e){
			gallery.removeImage && gallery.removeImage();
			$('.pswp__ui--hidden').removeClass('pswp__ui--hidden');
		});

		// 快捷键删除;
		var keyUp = function(e){
			if(!$('.pswp').hasClass('pswp--open')) return;
			if(e.key == 'Delete'){
				$('.pswp .pswp__button--remove').trigger('click');
			}
		};
		$('.pswp').unbind('keyup',keyUp).bind('keyup',keyUp);
	};
	
	// 显示原图; 如果设置有原图的情况;
	var bindShowImateTrue = function(){
		var $button = $('.pswp__button--show-true');
		var $download = $('.pswp__button--download'),canDownloadCheck = false;
		if(!$button.length){
			var html = '<button class="pswp__button pswp__button--show-true">'+(LNG['photoSwipe.showTrue'] || '')+'</button>';
			$button = $(html).insertAfter('.pswp__button--zoom');
		}
		if(!$download.length){
			var html = '<button class="pswp__button pswp__button--download"><i>'+(LNG['common.download'] || '')+'</i></button>';
			$download = $(html).insertAfter('.pswp__button--zoom');
		}
		
		var imageChange = function(){
			var currItem = gallery.currItem;
			if(!currItem || !currItem.src){return;}
			if(!canDownloadCheck){
				canDownloadCheck = true;
				if( $('.share-page-main.share-not-download').length || 
					(_.get(currItem,'data.pathInfo') && !_.get(currItem,'data.pathInfo.canDownload'))
				){
					$download.addClass('hidden');
				}
			}
			var method = currItem.trueImage ? 'removeClass':'addClass';
			$button[method]('hidden');
		};imageChange();
		gallery.listen('afterChange',imageChange);
		gallery.listen('afterErrorReload',imageChange);

		// 图片下载;
		$download.unbind('click').bind('click', function(e){
			var currItem  = gallery.currItem;
			if(!currItem){return;}
			var url = currItem.srcFile || currItem.src;
			var svgPre = 'data:image/svg+xml;base64,';
			if(_.isObject(currItem.data) && _.startsWith(currItem.data.src,svgPre)){
				var fileName = _.trim(currItem.data.title || '') || time();
				$.htmlDownload(currItem.data.src,fileName,'image/svg+xml');
				return;
			}
			
			// var blobUrl = (URL || webkitURL).createObjectURL(new Blob([url],{type:'image/svg+xml'}));
			// window.open(blobUrl);return;
			if(url.indexOf('?')){url += '&download=1';}
			url+='&accessToken='+G.kod.accessToken;
			window.open(url);
		});
		$button.unbind('click').bind('click', function(e){
			var currItem  = gallery.currItem;
			if(!currItem || !currItem.trueImage){return;}
			currItem._src = currItem.src;currItem.src = currItem.trueImage;

			var $img = $(currItem.container).find('.pswp__img:not(.pswp__img--placeholder)');
			var loading = $(".pswp__item.current").loadingMask(LNG['explorer.getting'])
			$img.attr('src',currItem.src).bind('load',function(){
				var style = {width:$img.width(),height:$img.height()};
				$img.css({width:'',height:''});
				currItem.w = $img.width();currItem.h = $img.height();
				$img.css(style); // 更新图片尺寸;
				photoSwipeView.updateSize();
				
				currItem.trueImage = false;imageChange();
				loading.close();
				$img.hide().fadeIn();
			}).bind('error',function(){
				loading.close();
				Tips.pop(LNG['explorer.error']);
			});
			photoSwipeView.updateSize();
		});
	};
	
	var itemInfoOpen = false;
	var bindItemInfo = function(){
		itemInfoOpen = false;
		if(artDialog){$('.pswp_content').css('z-index',artDialog.defaults.zIndex++);}
		gallery.listen('afterChange',function(){
			if(!lastImageList.itemChange) return;
			lastImageList.itemChange(gallery.currItem.data);
		});
		gallery.listen('close', function(){
			itemInfoOpen = false;
			$('.pswp_content').removeClass('panel-info-open')
			if(lastImageList.closeCallback){lastImageList.closeCallback();}
		});
		$('.pswp_content').addClass('dark-mode');
		
		if($('.pswp__button--info').length) return;
		var html = '<button class="pswp__button pswp__button--info"></button>';
		var $button = $(html).insertAfter('.pswp__button--close');
		if(!$('.file-panel-info').length){
			$('<div class="file-panel-info"></div>').appendTo('.pswp_content');
		}
		var closeView = function(){
			itemInfoOpen = false;
			if(!lastImageList.imageInfoCallback) return;
			$('.pswp_content').removeClass('panel-info-open')
			lastImageList.imageInfoCallback(false);
			photoSwipeView.updateSize();
		}
		var openView = function(){
			if(!lastImageList.imageInfoCallback) return;
			itemInfoOpen = true;
			$('.pswp_content').addClass('panel-info-open')
			lastImageList.imageInfoCallback(gallery.currItem.data,$('.file-panel-info'));
			photoSwipeView.updateSize();
		}
		$button.unbind('click').bind('click', function(e){
			itemInfoOpen ? closeView():openView();
		});
		$('.pswp_content').delegate('.panel-close','click',closeView);
	};
	
	var imageRotateItem = function(currItem,radius,isSave){
		if(!currItem || !currItem.container) return;
		var $image = $(currItem.container).find('.pswp__img');
		var style  = $image.last().attr('style') || '';
		var match  = style.match(/transform:\s*rotate\((\d+)deg\)/);
		if(radius == 'get'){return match ? match[1]:0;}

		var transform = radius ? 'rotate('+radius+'deg)' : '';
		if(isSave){
			$image.css('transition','all 0.3s');
			setTimeout(function(){$image.css('transition','');},310);
			radius = radius % 360;
			if(radius == 0){radius = null;}
			imageRotateList.set(currItem.src,radius);
		}

		if(gallery.items.length == 1){//一张图片情况下;
			$image = $(gallery.container).find('.pswp__img');
		}
		$image.css('transform',transform);
	};
	
	var openImageType = 'big';//big/full;

	//http://dimsemenov.com/plugins/royal-slider/gallery/
	//http://photoswipe.com/documentation/faq.html
	return function(path,ext,name,appStatic,appStaticDefault,showType){
		openImageType = showType || 'big';
		requireAsync([
			appStaticDefault+'PhotoSwipe/photoSwipe.html',
			appStatic+'PhotoSwipe/photoswipe.min',
			appStatic+'PhotoSwipe/photoswipe-ui-default.min',
			appStatic+'PhotoSwipe/photoswipe.css',
			appStatic+'PhotoSwipe/default-skin/default-skin.css',
		],function(photoSwipeTpl){
			initView(path,ext,name,photoSwipeTpl);
			bindClose();
			bindRotate();
			bindRemove();
			bindItemInfo();
			bindShowImateTrue();
		});
	};
});