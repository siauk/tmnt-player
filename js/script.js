$(document).ready(function(){
	var player = (function () {
		var vars = {},
			nodes = {
				body: $('body'),
				player: $('.player')
			},
			methods = {
				tracks: {
					prepare: function(){
						vars.files = [];
						vars.buffers = [];
						vars.tracks = [];
						vars.index = 0;
					},
					default: function(){
						var files = [
							{ caption: '1987 TMNT ENG.mp3', url: 'tracks/1987 TMNT ENG.mp3' },
							{ caption: '1987 TMNT RUS.mp3', url: 'tracks/1987 TMNT RUS.mp3' }
						];

						$.each(files, function(){
							methods.tracks.load(this);
							vars.files.push(this);
						});
					},
					load: function(file){
						var request = new XMLHttpRequest();

						request.open('GET', file.url, true);
						request.responseType = 'blob';
						request.send();

						request.onload = function() {
							request.response.caption = file.caption;
							methods.tracks.add([request.response], true);
						};
					},
					add: function(files, byDefault){
						if(!byDefault) {
							methods.player.disabled();
						}

						$.each(files, function() {
							if(vars.isOpera && (this.type === 'audio/mp3' || this.type === 'audio/mpeg')) {
								alert('This audio type is not supported in Opera');
								methods.player.interrupted();
							} else {
								methods.tracks.read(this);
								if(!byDefault) {
									vars.files.push(this);
								}
							}
						});
					},
					read: function(file){
						var reader = new FileReader();

						reader.readAsArrayBuffer(file);

						reader.onload = function() {
							file = methods.tracks.metadata(file, this.result);
							methods.tracks.decode(file, this.result);
						};
					},
					decode: function(file, result){
						vars.context.decodeAudioData(result, function(buffer) {
							var index = vars.tracks.length;

							methods.tracks.create(index, buffer);
							vars.buffers[index] = buffer;

							methods.player.add(file);

							if(vars.files.length === vars.tracks.length) {
								methods.player.enabled();
							}
						});
					},
					create: function(index, buffer){
						var track = vars.context.createBufferSource();

						track.buffer = buffer;
						track.onended = function(){
							if(vars.index === vars.tracks.length - 1) {
								methods.tracks.create(vars.index, vars.buffers[vars.index]);
								methods.player.pause();
							} else {
								methods.tracks.toggle(vars.index, ++vars.index);
							}
						};
						track = methods.tracks.connect(track);

						vars.tracks[index] =  track;
						console.log(vars.tracks);
					},
					connect: function(track){
						track.connect(vars.analyser);
						track.connect(vars.gain);
						track.connect(vars.filters[0]);
						track.connect(vars.context.destination);

						return track;
					},
					metadata: function(file,result){
						var data = new jDataView(result);

						file.title = '';
						file.artist = '';
						file.album = '';
						file.year = '';

						if (data.getString(3, data.byteLength - 128) == 'TAG') {
							file.title = data.getString(30, data.tell());
							file.artist = data.getString(30, data.tell());
							file.album = data.getString(30, data.tell());
							file.year = data.getString(4, data.tell());
						}

						return file;
					},
					play: function(index){
						var track = vars.tracks[index];

						if(track.isStart) {
							methods.tracks.connect(track);
						} else {
							track.start();
							track.isStart = true;

							if(!vars.interval) {
								methods.analyser.start('spectrum');
							}
						}

						track.isPlay = true;
						methods.player.play();
					},
					pause: function(index){
						var track = vars.tracks[index];

						track.disconnect();
						track.isPlay = false;
						methods.player.pause();
					},
					remove: function(index){
						if(index < vars.index) {
							vars.index--;
						} else if(index === vars.index){
							if(vars.tracks.length === 1) {
								methods.tracks.pause(index);
								nodes.buttons.filter('.button_play').addClass('button_disabled');
							}else if(index === vars.tracks.length - 1) {
								methods.tracks.toggle(index, --vars.index);
							} else {
								methods.tracks.toggle(index, index+1);
							}
						}

						vars.files.splice(index, 1);
						vars.buffers.splice(index, 1);
						vars.tracks.splice(index, 1);

						methods.player.remove(index);
						console.log(vars.tracks);
					},
					toggle: function(oldIndex, newIndex){
						if(vars.tracks[newIndex].isStart) {
							methods.tracks.create(newIndex, vars.buffers[newIndex]);
						}

						if(vars.tracks[oldIndex].isPlay) {
							methods.tracks.pause(oldIndex);
							methods.tracks.play(newIndex);
						}

						methods.player.navigation();
					}
				},
				analyser: {
					prepare: function(){
						vars.analyser = vars.context.createAnalyser();
						vars.analyser.fftSize = 64;
						vars.bufferLength = vars.analyser.frequencyBinCount;
						vars.dataArray = new Uint8Array(vars.bufferLength);

						nodes.canvas = document.getElementById('analyser');
						vars.contextCanvas = nodes.canvas.getContext('2d');

						vars.delay = 80;

						vars.canvasWidth = nodes.canvas.width;
						vars.canvasHeight = nodes.canvas.height;
						vars.canvasBg = '#81d7ef';
						vars.canvasLineWidth = 4;
						vars.canvasLineColor = '#080';

						vars.analyserType = 'spectrum';
						methods.analyser.draw(vars.analyserType);
					},
					start: function(type){
						vars.interval = setInterval(function(){
							methods.analyser.draw(type);
						}, vars.delay);
					},
					stop: function(){
						clearInterval(vars.interval);
					},
					toggle: function(type){
						methods.analyser.stop();
						methods.analyser.start(type);
					},
					draw: function(type){
						vars.analyser.getByteTimeDomainData(vars.dataArray);

						vars.contextCanvas.fillStyle = vars.canvasBg;
						vars.contextCanvas.fillRect(0, 0, vars.canvasWidth, vars.canvasHeight);

						if(type === 'waveform') {
							methods.analyser.waveform();
						} else if(type === 'spectrum') {
							methods.analyser.spectrum();
						}
					},
					waveform: function(){
						vars.contextCanvas.lineWidth = vars.canvasLineWidth;
						vars.contextCanvas.strokeStyle = vars.canvasLineColor;

						vars.contextCanvas.beginPath();

						var sliceWidth = vars.canvasWidth / vars.bufferLength,
							x = 0;

						for(var i = 0; i < vars.bufferLength; i++) {
							var v = vars.dataArray[i] / 128,
								y = v * vars.canvasHeight / 2;

							if(i === 0) {
								vars.contextCanvas.moveTo(x, vars.canvasHeight / 2);
							} else {
								vars.contextCanvas.lineTo(x, y);
							}

							x += sliceWidth;
						}

						vars.contextCanvas.lineTo(vars.canvasWidth, vars.canvasHeight / 2);
						vars.contextCanvas.stroke();
					},
					spectrum: function(){
						var barWidth = vars.canvasWidth / vars.bufferLength,
							barHeight,
							x = 0;

						for(var i = 0; i < vars.bufferLength; i++) {
							barHeight = vars.canvasHeight - vars.dataArray[i];

							vars.contextCanvas.fillStyle = 'rgb(0,' + (vars.dataArray[i] + 50) + ',0)';
							vars.contextCanvas.fillRect(x,vars.canvasHeight-barHeight,barWidth,barHeight);

							x += barWidth + 1;
						}
					}
				},
				gain:{
					prepare: function(){
						vars.gain = vars.context.createGain();
						vars.gain.connect(vars.analyser);
						vars.gain.connect(vars.context.destination);
						vars.gain.gain.value = 0;
					},
					change: function(){
						vars.gain.gain.value = this.value;
					}
				},
				equalizer: {
					prepare: function(){
						vars.config = [
							{ frequenciy: 32, type: 'lowshelf'},
							{ frequenciy: 64, type: 'peaking' },
							{ frequenciy: 125, type: 'peaking' },
							{ frequenciy: 250, type: 'peaking' },
							{ frequenciy: 500, type: 'peaking' },
							{ frequenciy: 1000, type: 'peaking' },
							{ frequenciy: 2000, type: 'peaking' },
							{ frequenciy: 4000, type: 'peaking' },
							{ frequenciy: 8000, type: 'peaking' },
							{ frequenciy: 16000, type: 'highshelf' }
						];

						vars.styles = {
							'normal': [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
							'classic': [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, -4.32, -4.32, -4.32, -5.76],
							'pop': [0.96, 2.88, 4.32, 4.80, 3.36, 0.00, -1.44, -1.44, 0.96, 0.96],
							'rock': [4.80, 2.88, -3.36, -4.80, -1.92, 2.40, 5.28, 6.72, 6.72, 6.72],
							'techno': [4.80, 3.36, 0.00, -3.36, -2.88, 0.00, 4.80, 5.76, 5.76, 5.28]
						};

						vars.filters = [];

						nodes.filters = $('.input_equalizer');

						methods.equalizer.create();
					},
					create: function(){
						$.each(vars.config, function(i){
							var filter = vars.context.createBiquadFilter();

							filter.type = this.type;
							filter.frequency.value = this.frequenciy;
							filter.Q.value = 1;
							filter.gain.value = 0;

							vars.filters.push(filter);

							if(i !== 0) {
								vars.filters[i-1].connect(vars.filters[i]);
							}
						});

						vars.filters[vars.filters.length - 1].connect(vars.analyser);
						vars.filters[vars.filters.length - 1].connect(vars.context.destination);
					},
					change: function(index){
						vars.filters[nodes.filters.index(this)].gain.value = this.value;
					},
					toggle: function(){
						var item = $(this),
							style = item.data('style');

						$.each(vars.filters, function(i){
							var value = vars.styles[style][i];

							this.gain.value = value;
							nodes.filters.eq(i).val(value);
						});

						methods.player.equalizer(item)
					}
				},
				player: {
					prepare: function(){
						vars.count = 5;
						vars.step = 0;
						vars.offset = 25;

						nodes.inputFile = nodes.player.find('.input_file');
						nodes.output = nodes.player.find('.player_output');
						nodes.tracksList = nodes.player.find('.list_tracks');
						nodes.metadataList = nodes.player.find('.list_metadata');
						nodes.equalizerControls = nodes.player.find('.control_equalizer');
						nodes.buttons = nodes.player.find('.button');
					},
					slide: function(){
						if(nodes.player.hasClass('player_closed')) {
							nodes.player.removeClass('player_closed');
						} else {
							nodes.player.addClass('player_closed');
						}
					},
					toggle: function(){
						var output = $(this).data('output');

						nodes.output.filter(':not([data-output="' + output + '"])').hide();
						nodes.output.filter('[data-output="' + output + '"]').fadeIn();
					},
					disabled: function(){
						nodes.output.filter('[data-output="add"]').addClass('player_load');
						nodes.inputFile.addClass('input_load');
						nodes.buttons.addClass('button_disabled');
					},
					enabled: function(){
						nodes.output.filter('[data-output="add"]').removeClass('player_load');
						nodes.inputFile.removeClass('input_load');
						nodes.buttons.removeClass('button_disabled');
						nodes.output.filter('[data-output="add"]').hide();
						nodes.output.filter('[data-output="tracks"]').fadeIn();

						methods.player.navigation();
					},
					interrupted: function(){
						nodes.output.filter('[data-output="add"]').removeClass('player_load');
						nodes.inputFile.removeClass('input_load');
						nodes.buttons.filter(':not(.button_play)').removeClass('button_disabled');

						methods.player.navigation();
					},
					play: function(){
						nodes.buttons.filter('.button_play')
							.removeClass('button_play')
							.addClass('button_pause');
					},
					pause: function(){
						nodes.buttons.filter('.button_pause')
							.removeClass('button_pause')
							.addClass('button_play');
					},
					add: function(file){
						var caption = file.caption || file.name;
						nodes.tracksList.append('<li>' + caption + '<i class="control control_hidden control_info"></i><i class="control control_hidden control_remove"></i></li>');
					},
					remove: function(index){
						nodes.tracksList.find('li').eq(index).remove();
						methods.player.navigation();
					},
					metadata: function(){
						var file = vars.files[nodes.tracksList.find('.control_info').index($(this))],
							html = [];

						html.push('<li>Title: ' + file.title + '</li>');
						html.push('<li>Artist: ' + file.artist + '</li>');
						html.push('<li>Album: ' + file.album + '</li>');
						html.push('<li>Year: ' + file.year + '</li>');

						nodes.metadataList.html(html.join(''));
						nodes.output.filter('[data-output="tracks"]').hide();
						nodes.output.filter('[data-output="metadata"]').fadeIn();
					},
					navigation: function(){
						if(vars.index - vars.count === vars.step) {
							nodes.tracksList.css({'margin-top': -(++vars.step * vars.offset) + 'px'});
						} else if(vars.index + 1 === vars.step) {
							nodes.tracksList.css({'margin-top': -(--vars.step * vars.offset) + 'px'});
						}

						nodes.tracksList.find('.list_item_active').removeClass('list_item_active');
						nodes.tracksList.find('li').eq(vars.index).addClass('list_item_active');

						if(vars.tracks.length < 2) {
							nodes.buttons.filter('.button_prev').addClass('button_disabled');
							nodes.buttons.filter('.button_next').addClass('button_disabled');
						} else if(vars.index === 0) {
							nodes.buttons.filter('.button_prev').addClass('button_disabled');
							nodes.buttons.filter('.button_next').removeClass('button_disabled');
						} else if(vars.index === vars.tracks.length - 1) {
							nodes.buttons.filter('.button_prev').removeClass('button_disabled');
							nodes.buttons.filter('.button_next').addClass('button_disabled');
						} else {
							nodes.buttons.filter('.button_prev').removeClass('button_disabled');
							nodes.buttons.filter('.button_next').removeClass('button_disabled');
						}
					},
					analyser: function(){
						vars.analyserType = vars.analyserType === 'spectrum' ? 'waveform' : 'spectrum';
						methods.analyser.toggle(vars.analyserType);
					},
					equalizer: function(item){
						nodes.equalizerControls.filter('.control_active').removeClass('control_active');
						item.addClass('control_active');
					}
				},
				events: function(){
					nodes.player
						.on('click', '.player_shell', methods.player.slide)
						.on('change', '.input_file', function(){ methods.tracks.add(this.files) })
						.on('click', '.control_info', methods.player.metadata)
						.on('click', '.control_remove', function(){ methods.tracks.remove(nodes.tracksList.find('.control_remove').index($(this))) })
						.on('click', '.control_analyser', methods.player.analyser)
						.on('input', '.input_equalizer', methods.equalizer.change)
						.on('click', '.control_equalizer', methods.equalizer.toggle)
						.on('click', '.button[data-output]:not(.button_disabled)', methods.player.toggle)
						.on('click', '.button_play:not(.button_disabled)', function(){ methods.tracks.play(vars.index); })
						.on('click', '.button_pause', function(){ methods.tracks.pause(vars.index); })
						.on('click', '.button_prev:not(.button_disabled)', function(){ methods.tracks.toggle(vars.index, --vars.index); })
						.on('click', '.button_next:not(.button_disabled)', function(){ methods.tracks.toggle(vars.index, ++vars.index); })
						.on('input', '.input_gain', methods.gain.change);
				}
			};
		return {
			init: function () {
				try {
					window.AudioContext = window.AudioContext||window.webkitAudioContext;
					vars.context = new AudioContext();

					methods.tracks.prepare();
					methods.analyser.prepare();
					methods.gain.prepare();
					methods.equalizer.prepare();
					methods.player.prepare();
					methods.tracks.default();
					methods.events();

					vars.isOpera = navigator.userAgent.indexOf(' OPR/') >= 0;
				} catch(e) {
					alert('Web Audio API is not supported in this browser');
				}
			}
		}
	}());
	player.init();
});