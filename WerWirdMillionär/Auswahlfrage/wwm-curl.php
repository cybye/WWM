<?
	set_time_limit(60);
	$url = "http://wwm.cybye.de/api/v1/create";
	$headers = array(
		'secret' => '123456',
		'id' => 'test1966',
		'name' => 'this+is+the+name+of+this'
	);
	
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_VERBOSE, TRUE);
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
	$output = curl_exec($ch);
