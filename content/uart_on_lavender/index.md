+++
title = "UART on Xiaomi Redmi Note 7"
description = "This blog describes the state of UART on Redmi Note 7 (codename: lavender) and my journey chasing it."
tags = ["android", "gsoc2020", "sharkbait"]
date = "2020-06-02"
+++

This blog is a short sequel to my previous [blog](@/android_boot_high_jinks.md) where I discussed why I needed to access a serial console on Redmi Note 7 (I'll refer to it using its codename, lavender here onwards). I should give a disclaimer that this blog is one dead-end in the GSoC2020 series. But it could always help newcomers and other curious souls.

---
## The Need of a Serial Console
My first attempt at porting SharkBait for SAR failed. I was confident about the approach but had trouble finding out what went wrong. If only somehow I could get the kernel logs before my phone went into the bootloop, I could quickly provide fixes.

Fortunately that is when I found [this article](https://wiki.postmarketos.org/wiki/Xiaomi_Redmi_Note_7_(xiaomi-lavender)) from the awesome guys at PostMarketOS. My device had a serial console built in. Accessing it via UART could provide the logs I required. 

So I followed the process described there and disassembled my phone, soldered the required jumper wires to the GPIO pins mentioned in the article and was ready for connecting it to a convertor. 

_Please excuse the potato quality of the upcoming images._

{{ image(src="smallfull.jpg", alt="Opening the back", caption="Opening the back") }} 
{{ image(src="smallpins.jpg", alt="GPIO pins", caption="Soldered the wires on the GPIO pins") }}

## PL2303HXA
After that, I connected the jumper wires to the PL2303HXA convertor I bought and quickly fired up a `screen` session, excited to look at the console output.

But there was [no output](https://youtu.be/UGSwtv_PKHE). You can see that the convertor's RX LED is blinking when the phone boots up, but there is no output on the console end.

I consulted around with people at PostMarketOS and the SharkBait IRC chat. KireinaHoro asked me to grab a multimeter and check out the voltage the UART operated on. The GPIO pins were at a voltage difference of 1.8V with the ground. I came to the realisation that the PL2303 could not interpret signals with voltage that low. So I decided to buy another convertor, about which I was sure to read signals at 1.8V.

## FT232R
{{ image(src="smallFT232R.jpg", alt="FT2303R based convertor", caption="FT232R based convertor") }}
{{ image(src="smallfinal.jpg", alt="FT2303R", caption="Final Product") }}

With my fingers crossed, I fired up another `screen` shell, and finally got _some_ output. 
But all I got were the logs thrown by the Bootloader. I needed the kernel logs because the `init` is launched by the kernel. And so yet again, I went to chat with Alexey from PostMarketOS who is working on lavender. He informed me that the vendor's downstream kernel for lavender would not give any UART logs for some reason [(related)](https://github.com/minlexx/android_kernel_xiaomi_lavender/blob/lineage-16.0/arch/arm/boot/dts/qcom/sdm660-pinctrl.dtsi#L69). To get the kernel logs via UART, we would have to use the mainline kernel, but that would mean no android for us.

---

So I had two options :
- Work on bringing UART to lavender by patching the vendor's downstream kernel. But this would take a lot of time from a _very_ beginner kernel hacker like me. Also it would be rather too off-topic from my original GSoC journey.
- Abandon UART altogether. I had some very hacky debugs in mind which I could use. It would take some time to yield a fruitful result but this was a lower hanging fruit.

And so, I chose the second option.

Which I am very glad to share, worked out. As of yesterday, I was finally able to boot Gentoo via the preinit, but all that's for another blog (coming tomorrow).
