import { Module } from '@nestjs/common';
import { DesmosMorpheusService } from './desmos-morpheus/desmos-morpheus.service';
import { ConfigModule } from '@nestjs/config';
import { StoryModule } from 'src/story/story.module';

@Module({
  imports: [ConfigModule, StoryModule],
  providers: [DesmosMorpheusService],
  exports: [DesmosMorpheusService],
})
export class DesmosModule {}
