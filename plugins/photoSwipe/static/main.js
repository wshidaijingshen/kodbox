kodReady.push(function(){
	if(!$.supportCanvas()) return;
	LNG.set(jsonDecode(urlDecode("{{LNG}}")));
	Events.bind('explorer.kodApp.before',function(appList){
		appList.push({
			name:'{{package.id}}',
			title:'{{package.name}}',
			ext:"{{config.fileExt}}",
			sort:"{{config.fileSort}}",
			icon:"x-item-icon x-gif",
			callback:function(path,ext,name){
				var appStatic = "{{pluginHost}}static/";
				var appStaticDefault = "{{pluginHostDefault}}static/";
				var showType = '{{config.showType}}';
				requireAsync(appStatic+'page.js',function(app){
					app(path,ext,name,appStatic,appStaticDefault,showType);
				});
			}
		});
	});
});